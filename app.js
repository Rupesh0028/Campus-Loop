"use strict";

/*
 * CampusLoop frontend
 * Features:
 * - Register and login
 * - JWT authentication
 * - Load the current user
 * - Create, search, edit, and delete listings
 * - Start conversations with sellers
 * - Load conversation history
 * - Real-time chat with STOMP over WebSocket
 *
 * Backend base URL: http://localhost:8080
 */

const API_BASE = "http://localhost:8080/api";
const WS_URL = "http://localhost:8080/ws";
const TOKEN_KEY = "campusloop_token";

// --------------------------------------------------
// DOM HELPERS
// --------------------------------------------------

const $ = (selector) => document.querySelector(selector);

const getElement = (...selectors) => {
    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
    }

    return null;
};

const escapeHTML = (value) => {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const replacements = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return replacements[character];
    });
};

const formatDate = (value) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString();
};

const getToken = () => localStorage.getItem(TOKEN_KEY);

const isLoggedIn = () => Boolean(getToken());

const getFormValue = (form, ...names) => {
    for (const name of names) {
        const field = form.elements.namedItem(name);

        if (field && typeof field.value === "string") {
            return field.value.trim();
        }
    }

    return "";
};

// --------------------------------------------------
// APPLICATION STATE
// --------------------------------------------------

let currentUser = null;
let currentUserId = null;

let listings = [];

let stompClient = null;
let activeSubscription = null;
let activeConversationId = null;

let conversations = [];
let renderedMessageIds = new Set();

let isConnectingChat = false;

// --------------------------------------------------
// MESSAGE / STATUS HELPERS
// --------------------------------------------------

function showMessage(message, type = "info") {
    let messageElement = getElement(
        "#message",
        "#status-message",
        "#app-message",
        "#notification"
    );

    if (!messageElement) {
        messageElement = document.createElement("div");
        messageElement.id = "app-message";
        messageElement.setAttribute("role", "status");

        document.body.prepend(messageElement);
    }

    messageElement.textContent = message;
    messageElement.dataset.type = type;

    messageElement.style.display = "block";

    if (type === "error") {
        messageElement.style.color = "#b91c1c";
    } else if (type === "success") {
        messageElement.style.color = "#15803d";
    } else {
        messageElement.style.color = "";
    }
}

function clearMessage() {
    const messageElement = getElement(
        "#message",
        "#status-message",
        "#app-message",
        "#notification"
    );

    if (messageElement) {
        messageElement.textContent = "";
        messageElement.style.display = "none";
    }
}

function setChatStatus(message) {
    const statusElement = $("#chat-status");

    if (statusElement) {
        statusElement.textContent = message;
    }
}

function requireLoginMessage() {
    showMessage("Please log in to use this feature.", "error");
}

// --------------------------------------------------
// API HELPER
// --------------------------------------------------

async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});

    if (!headers.has("Accept")) {
        headers.set("Accept", "application/json");
    }

    const token = getToken();

    if (token && !headers.has("Authorization")) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    let body = options.body;

    if (
        body !== undefined &&
        body !== null &&
        typeof body !== "string" &&
        !(body instanceof FormData) &&
        !(body instanceof Blob)
    ) {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        body
    });

    if (response.status === 204) {
        if (!response.ok) {
            throw new Error("The request could not be completed.");
        }

        return null;
    }

    const contentType = response.headers.get("content-type") || "";
    let responseData = null;

    if (contentType.includes("application/json")) {
        responseData = await response.json();
    } else {
        const text = await response.text();
        responseData = text ? { message: text } : null;
    }

    if (!response.ok) {
        if (response.status === 401 && getToken()) {
            handleExpiredSession();
        }

        const errorMessage =
            responseData?.message ||
            responseData?.detail ||
            responseData?.error ||
            (typeof responseData === "string" ? responseData : "") ||
            `Request failed (${response.status}).`;

        throw new Error(errorMessage);
    }

    return responseData;
}

function handleExpiredSession() {
    localStorage.removeItem(TOKEN_KEY);
    currentUser = null;
    currentUserId = null;

    disconnectChat();

    updateAccountUI();

    setChatStatus("Your session expired. Please log in again.");
}

// --------------------------------------------------
// AUTHENTICATION
// --------------------------------------------------

async function registerUser(event) {
    event.preventDefault();
    clearMessage();

    const form = event.currentTarget;

    const fullName = getFormValue(form, "fullName", "name");
    const email = getFormValue(form, "email");
    const password = getFormValue(form, "password");
    const collegeName = getFormValue(form, "collegeName", "college");

    if (!fullName || !email || !password || !collegeName) {
        showMessage("Please fill in all registration fields.", "error");
        return;
    }

    try {
        await apiRequest("/auth/register", {
            method: "POST",
            body: {
                fullName,
                email,
                password,
                collegeName
            }
        });

        form.reset();

        showMessage(
            "Registration successful! Please log in.",
            "success"
        );

        const loginEmail = getElement(
            '#login-form [name="email"]',
            '#login-form [name="username"]'
        );

        if (loginEmail) {
            loginEmail.value = email;
        }
    } catch (error) {
        showMessage(error.message || "Registration failed.", "error");
    }
}

async function loginUser(event) {
    event.preventDefault();
    clearMessage();

    const form = event.currentTarget;

    const email = getFormValue(form, "email", "username");
    const password = getFormValue(form, "password");

    if (!email || !password) {
        showMessage("Enter your email and password.", "error");
        return;
    }

    try {
        const result = await apiRequest("/auth/login", {
            method: "POST",
            body: { email, password }
        });

        const token =
            result?.token ||
            result?.accessToken ||
            result?.jwt;

        if (!token) {
            throw new Error(
                "Login succeeded but the server did not return a JWT token. Check AuthResponse.java."
            );
        }

        localStorage.setItem(TOKEN_KEY, token);

        await loadCurrentUser();

        form.reset();

        updateAccountUI();

        await loadListings();

        showMessage("Logged in successfully!", "success");

        await loadConversations();
    } catch (error) {
        localStorage.removeItem(TOKEN_KEY);
        currentUser = null;
        currentUserId = null;

        updateAccountUI();

        showMessage(error.message || "Login failed.", "error");
    }
}

async function loadCurrentUser() {
    if (!getToken()) {
        currentUser = null;
        currentUserId = null;
        return null;
    }

    try {
        const user = await apiRequest("/auth/me");

        currentUser = user;
        currentUserId = user?.id ?? null;

        return user;
    } catch (error) {
        currentUser = null;
        currentUserId = null;

        throw error;
    }
}

async function logoutUser() {
    disconnectChat();

    localStorage.removeItem(TOKEN_KEY);

    currentUser = null;
    currentUserId = null;
    activeConversationId = null;
    conversations = [];
    renderedMessageIds.clear();

    const messagesElement = $("#chat-messages");
    const titleElement = $("#chat-title");
    const conversationList = $("#conversation-list");

    if (messagesElement) messagesElement.replaceChildren();
    if (conversationList) conversationList.replaceChildren();

    if (titleElement) {
        titleElement.textContent = "Select a conversation";
    }

    setChatStatus("Log in to start chatting.");

    updateAccountUI();

    await loadListings();

    showMessage("You have logged out.", "success");
}

function updateAccountUI() {
    const registerForm = $("#register-form");
    const loginForm = $("#login-form");
    const logoutButton = getElement("#logout-btn", "#logout-button");
    const accountStatus = getElement("#account-status", "#user-status");
    const chatSection = $("#chat");

    if (registerForm) {
        registerForm.hidden = isLoggedIn();
    }

    if (loginForm) {
        loginForm.hidden = isLoggedIn();
    }

    if (logoutButton) {
        logoutButton.hidden = !isLoggedIn();
    }

    if (accountStatus) {
        accountStatus.textContent = currentUser
            ? `Logged in as ${currentUser.fullName || currentUser.email}`
            : "You are not logged in.";
    }

    if (chatSection) {
        chatSection.hidden = !isLoggedIn();
    }
}

// --------------------------------------------------
// LISTINGS
// --------------------------------------------------

function normalizeListingResponse(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.content)) {
        return data.content;
    }

    if (Array.isArray(data?.items)) {
        return data.items;
    }

    return [];
}

function getSearchFilters() {
    const form = $("#search-form");

    if (!form) {
        return {};
    }

    return {
        keyword: getFormValue(form, "keyword", "search", "title"),
        category: getFormValue(form, "category"),
        city: getFormValue(form, "city")
    };
}

async function loadListings() {
    const grid = getElement(
        "#listing-grid",
        "#listings-container",
        "#listings",
        "#listing-container"
    );

    if (grid) {
        grid.innerHTML = "<p>Loading listings...</p>";
    }

    try {
        const filters = getSearchFilters();
        const params = new URLSearchParams();

        for (const [key, value] of Object.entries(filters)) {
            if (value) {
                params.set(key, value);
            }
        }

        const queryString = params.toString();
        const endpoint = queryString
            ? `/listings?${queryString}`
            : "/listings";

        const result = await apiRequest(endpoint);

        listings = normalizeListingResponse(result);

        renderListings(listings);
    } catch (error) {
        if (grid) {
            grid.innerHTML = `<p>${escapeHTML(
                error.message || "Could not load listings."
            )}</p>`;
        }

        showMessage(error.message || "Could not load listings.", "error");
    }
}

function renderListings(items) {
    const grid = getElement(
        "#listing-grid",
        "#listings-container",
        "#listings",
        "#listing-container"
    );

    if (!grid) {
        console.warn(
            "Listing container not found. Expected #listing-grid or #listings-container."
        );
        return;
    }

    if (!items.length) {
        grid.innerHTML = "<p>No listings found. Try another search.</p>";
        return;
    }

    grid.innerHTML = items.map((listing) => {
        const id = Number(listing.id);
        const price = Number(listing.price);
        const formattedPrice = Number.isFinite(price)
            ? price.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 2
            })
            : escapeHTML(listing.price);

        const isOwner =
            currentUserId !== null &&
            Number(listing.sellerId ?? listing.seller?.id) ===
                Number(currentUserId);

        const sellerName =
            listing.sellerName ||
            listing.seller?.fullName ||
            "CampusLoop student";

        return `
            <article class="listing-card" data-listing-id="${id}">
                <div class="listing-card-content">
                    <span class="listing-category">
                        ${escapeHTML(listing.category || "Other")}
                    </span>

                    <h3>${escapeHTML(listing.title || "Untitled listing")}</h3>

                    <p class="listing-description">
                        ${escapeHTML(listing.description || "")}
                    </p>

                    <p class="listing-price">${formattedPrice}</p>

                    <p>
                        <strong>Condition:</strong>
                        ${escapeHTML(listing.itemCondition || "Not specified")}
                    </p>

                    <p>
                        <strong>City:</strong>
                        ${escapeHTML(listing.city || "Not specified")}
                    </p>

                    <p>
                        <strong>Pickup:</strong>
                        ${escapeHTML(listing.pickupLocation || "Contact seller")}
                    </p>

                    <p>
                        <strong>Seller:</strong>
                        ${escapeHTML(sellerName)}
                    </p>

                    <div class="listing-actions">
                        ${
                            isLoggedIn() && !isOwner
                                ? `<button type="button"
                                           class="message-seller-btn"
                                           data-listing-id="${id}">
                                       Message seller
                                   </button>`
                                : ""
                        }

                        ${
                            isOwner
                                ? `<button type="button"
                                           class="delete-listing-btn"
                                           data-listing-id="${id}">
                                       Delete listing
                                   </button>`
                                : ""
                        }
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

async function createListing(event) {
    event.preventDefault();
    clearMessage();

    if (!isLoggedIn()) {
        requireLoginMessage();
        return;
    }

    const form = event.currentTarget;

    const listingData = {
        title: getFormValue(form, "title"),
        description: getFormValue(form, "description"),
        category: getFormValue(form, "category"),
        price: getFormValue(form, "price"),
        itemCondition: getFormValue(form, "itemCondition", "condition"),
        city: getFormValue(form, "city"),
        pickupLocation: getFormValue(form, "pickupLocation")
    };

    if (
        !listingData.title ||
        !listingData.description ||
        !listingData.category ||
        !listingData.price ||
        !listingData.itemCondition ||
        !listingData.city ||
        !listingData.pickupLocation
    ) {
        showMessage("Please complete all listing fields.", "error");
        return;
    }

    const price = Number(listingData.price);

    if (!Number.isFinite(price) || price < 0) {
        showMessage("Enter a valid listing price.", "error");
        return;
    }

    listingData.price = price;

    try {
        await apiRequest("/listings", {
            method: "POST",
            body: listingData
        });

        form.reset();

        showMessage("Your listing has been created.", "success");

        await loadListings();
    } catch (error) {
        showMessage(error.message || "Could not create listing.", "error");
    }
}

async function deleteListing(listingId) {
    if (!isLoggedIn()) {
        requireLoginMessage();
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to delete this listing?"
    );

    if (!confirmed) {
        return;
    }

    try {
        await apiRequest(`/listings/${encodeURIComponent(listingId)}`, {
            method: "DELETE"
        });

        showMessage("Listing deleted successfully.", "success");

        await loadListings();
    } catch (error) {
        showMessage(error.message || "Could not delete listing.", "error");
    }
}

async function handleListingAction(event) {
    const messageButton = event.target.closest(".message-seller-btn");
    const deleteButton = event.target.closest(".delete-listing-btn");

    if (messageButton) {
        const listingId = messageButton.dataset.listingId;

        if (listingId) {
            await startConversation(listingId);
        }

        return;
    }

    if (deleteButton) {
        const listingId = deleteButton.dataset.listingId;

        if (listingId) {
            await deleteListing(listingId);
        }
    }
}

// --------------------------------------------------
// CONVERSATIONS
// --------------------------------------------------

function normalizeConversationResponse(data) {
    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.content)) {
        return data.content;
    }

    if (Array.isArray(data?.items)) {
        return data.items;
    }

    return [];
}

async function startConversation(listingId) {
    if (!isLoggedIn()) {
        requireLoginMessage();
        return;
    }

    try {
        const conversation = await apiRequest("/conversations", {
            method: "POST",
            body: {
                listingId: Number(listingId)
            }
        });

        if (!conversation?.id) {
            throw new Error(
                "The server did not return a conversation ID."
            );
        }

        await loadConversations();
        await openConversation(conversation.id);

        const chatSection = $("#chat");

        if (chatSection) {
            chatSection.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }
    } catch (error) {
        showMessage(
            error.message || "Could not start this conversation.",
            "error"
        );
    }
}

async function loadConversations() {
    const listElement = $("#conversation-list");

    if (!isLoggedIn()) {
        if (listElement) {
            listElement.innerHTML = "<p>Log in to see your conversations.</p>";
        }

        conversations = [];
        return;
    }

    try {
        const data = await apiRequest("/conversations");

        conversations = normalizeConversationResponse(data);

        renderConversations();
    } catch (error) {
        if (listElement) {
            listElement.innerHTML = `<p>${escapeHTML(
                error.message || "Could not load conversations."
            )}</p>`;
        }
    }
}

function renderConversations() {
    const listElement = $("#conversation-list");

    if (!listElement) {
        return;
    }

    if (!conversations.length) {
        listElement.innerHTML = "<p>No conversations yet.</p>";
        return;
    }

    listElement.innerHTML = conversations.map((conversation) => {
        const isBuyer =
            Number(conversation.buyerId) === Number(currentUserId);

        const otherPerson = isBuyer
            ? conversation.sellerName
            : conversation.buyerName;

        const isActive =
            Number(conversation.id) === Number(activeConversationId);

        return `
            <button
                type="button"
                class="conversation-item ${isActive ? "active" : ""}"
                data-conversation-id="${Number(conversation.id)}"
            >
                <strong>${escapeHTML(conversation.listingTitle || "Listing")}</strong>
                <span>${escapeHTML(otherPerson || "Student")}</span>
            </button>
        `;
    }).join("");
}

async function openConversation(conversationId) {
    if (!isLoggedIn()) {
        requireLoginMessage();
        return;
    }

    const conversation = conversations.find(
        (item) => Number(item.id) === Number(conversationId)
    );

    if (!conversation) {
        // The conversation might have been created just now.
        await loadConversations();
    }

    const selectedConversation = conversations.find(
        (item) => Number(item.id) === Number(conversationId)
    );

    activeConversationId = Number(conversationId);
    renderedMessageIds.clear();

    const titleElement = $("#chat-title");
    const messagesElement = $("#chat-messages");

    if (titleElement) {
        const isBuyer =
            Number(selectedConversation?.buyerId) === Number(currentUserId);

        const otherPerson = isBuyer
            ? selectedConversation?.sellerName
            : selectedConversation?.buyerName;

        titleElement.textContent =
            `${selectedConversation?.listingTitle || "Conversation"} — ` +
            `${otherPerson || "Student"}`;
    }

    if (messagesElement) {
        messagesElement.replaceChildren();
    }

    renderConversations();

    // Subscribe before loading history so messages sent during the history
    // request are less likely to be missed. Message IDs prevent duplicates.
    connectChat();

    if (stompClient?.connected) {
        subscribeToConversation(activeConversationId);
    }

    await loadMessages(activeConversationId);
}

async function loadMessages(conversationId) {
    const messagesElement = $("#chat-messages");

    if (!messagesElement) {
        return;
    }

    try {
        setChatStatus("Loading messages...");

        const data = await apiRequest(
            `/conversations/${encodeURIComponent(conversationId)}/messages`
        );

        if (Number(activeConversationId) !== Number(conversationId)) {
            return;
        }

        const messages = Array.isArray(data)
            ? data
            : Array.isArray(data?.content)
                ? data.content
                : [];

        for (const message of messages) {
            renderChatMessage(message);
        }

        setChatStatus(
            stompClient?.connected
                ? "Connected. Messages update in real time."
                : "Loading chat connection..."
        );

        messagesElement.scrollTop = messagesElement.scrollHeight;
    } catch (error) {
        setChatStatus(error.message || "Could not load messages.");
    }
}

// --------------------------------------------------
// REAL-TIME CHAT: STOMP / WEBSOCKET
// --------------------------------------------------

function connectChat() {
    if (!isLoggedIn()) {
        setChatStatus("Log in to start chatting.");
        return;
    }

    if (stompClient?.connected || isConnectingChat) {
        return;
    }

    if (typeof StompJs === "undefined" || !StompJs.Client) {
        setChatStatus(
            "Chat library not found. Check the STOMP script in index.html."
        );
        console.error("StompJs is missing. Load the STOMP UMD script before app.js.");
        return;
    }

    const token = getToken();

    if (!token) {
        setChatStatus("Please log in to start chatting.");
        return;
    }

    isConnectingChat = true;

    const client = new StompJs.Client({
        brokerURL: WS_URL,
        connectHeaders: {
            Authorization: `Bearer ${token}`
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,

        onConnect: () => {
            isConnectingChat = false;

            if (client !== stompClient) {
                return;
            }

            setChatStatus("Connected. Messages update in real time.");

            if (activeConversationId !== null) {
                subscribeToConversation(activeConversationId);
            }
        },

        onStompError: (frame) => {
            isConnectingChat = false;

            const reason =
                frame.headers?.message ||
                frame.body ||
                "The chat server rejected the connection.";

            setChatStatus(reason);
            console.error("STOMP error:", reason);
        },

        onWebSocketClose: () => {
            isConnectingChat = false;

            if (client === stompClient && isLoggedIn()) {
                setChatStatus("Chat disconnected. Reconnecting...");
            }
        },

        onWebSocketError: (error) => {
            console.error("WebSocket error:", error);
            setChatStatus("Could not connect to chat. Check the backend.");
        },

        onDisconnect: () => {
            isConnectingChat = false;
        }
    });

    stompClient = client;

    try {
        client.activate();
    } catch (error) {
        isConnectingChat = false;
        console.error("Could not activate chat:", error);
        setChatStatus("Could not start chat connection.");
    }
}

function subscribeToConversation(conversationId) {
    if (!stompClient?.connected || conversationId == null) {
        return;
    }

    const numericId = Number(conversationId);

    if (!Number.isFinite(numericId)) {
        return;
    }

    const destination = `/topic/conversations/${numericId}`;

    if (
        activeSubscription &&
        activeSubscription.destination === destination
    ) {
        return;
    }

    if (activeSubscription) {
        activeSubscription.unsubscribe();
        activeSubscription = null;
    }

    activeSubscription = stompClient.subscribe(
        destination,
        (frame) => {
            if (Number(activeConversationId) !== numericId) {
                return;
            }

            try {
                const message = JSON.parse(frame.body);
                renderChatMessage(message);
            } catch (error) {
                console.error("Could not parse chat message:", error);
            }
        }
    );

    setChatStatus("Connected. Messages update in real time.");
}

function renderChatMessage(message) {
    const messagesElement = $("#chat-messages");

    if (!messagesElement || !message) {
        return;
    }

    if (
        message.conversationId != null &&
        Number(message.conversationId) !== Number(activeConversationId)
    ) {
        return;
    }

    if (message.id != null) {
        const messageId = String(message.id);

        if (renderedMessageIds.has(messageId)) {
            return;
        }

        renderedMessageIds.add(messageId);
    }

    const isMine =
        currentUserId !== null &&
        Number(message.senderId) === Number(currentUserId);

    const messageElement = document.createElement("div");

    messageElement.className = isMine
        ? "chat-message mine"
        : "chat-message";

    const senderElement = document.createElement("strong");
    senderElement.className = "chat-message-sender";
    senderElement.textContent = isMine
        ? "You"
        : (message.senderName || "Student");

    const contentElement = document.createElement("p");
    contentElement.className = "chat-message-content";
    contentElement.textContent = message.content || "";

    const timeElement = document.createElement("small");
    timeElement.className = "chat-message-time";
    timeElement.textContent = formatDate(message.sentAt);

    messageElement.append(senderElement, contentElement, timeElement);
    messagesElement.appendChild(messageElement);

    messagesElement.scrollTop = messagesElement.scrollHeight;
}

async function sendChatMessage(event) {
    event.preventDefault();

    if (!isLoggedIn()) {
        requireLoginMessage();
        return;
    }

    if (activeConversationId === null) {
        setChatStatus("Select a conversation first.");
        return;
    }

    const form = event.currentTarget;
    const input = form.elements.namedItem("content");

    if (!input) {
        setChatStatus("Message input was not found.");
        return;
    }

    const content = input.value.trim();

    if (!content) {
        return;
    }

    if (content.length > 2000) {
        setChatStatus("Messages cannot exceed 2000 characters.");
        return;
    }

    const conversationId = activeConversationId;

    try {
        if (stompClient?.connected) {
            stompClient.publish({
                destination: `/app/conversations/${conversationId}/send`,
                headers: {
                    Authorization: `Bearer ${getToken()}`
                },
                body: JSON.stringify({ content })
            });

            input.value = "";
            input.focus();
            setChatStatus("Message sent.");
        } else {
            // REST fallback if WebSocket is temporarily disconnected.
            const savedMessage = await apiRequest(
                `/conversations/${conversationId}/messages`,
                {
                    method: "POST",
                    body: { content }
                }
            );

            if (savedMessage) {
                renderChatMessage(savedMessage);
            }

            input.value = "";
            input.focus();
            setChatStatus("Message sent. Real-time connection is unavailable.");
        }
    } catch (error) {
        setChatStatus(error.message || "Could not send your message.");
    }
}

function disconnectChat() {
    if (activeSubscription) {
        try {
            activeSubscription.unsubscribe();
        } catch (error) {
            console.warn("Could not unsubscribe from chat:", error);
        }

        activeSubscription = null;
    }

    if (stompClient) {
        const client = stompClient;

        stompClient = null;
        isConnectingChat = false;

        try {
            client.deactivate();
        } catch (error) {
            console.warn("Could not disconnect chat:", error);
        }
    }
}

// --------------------------------------------------
// EVENT LISTENERS
// --------------------------------------------------

function initializeEventListeners() {
    const registerForm = $("#register-form");
    const loginForm = $("#login-form");
    const listingForm = $("#listing-form");
    const searchForm = $("#search-form");
    const chatForm = $("#chat-form");

    const logoutButton = getElement("#logout-btn", "#logout-button");

    if (registerForm) {
        registerForm.addEventListener("submit", registerUser);
    }

    if (loginForm) {
        loginForm.addEventListener("submit", loginUser);
    }

    if (listingForm) {
        listingForm.addEventListener("submit", createListing);
    }

    if (searchForm) {
        searchForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            await loadListings();
        });
    }

    if (chatForm) {
        chatForm.addEventListener("submit", sendChatMessage);
    }

    if (logoutButton) {
        logoutButton.addEventListener("click", logoutUser);
    }

    const listingContainer = getElement(
        "#listing-grid",
        "#listings-container",
        "#listings",
        "#listing-container"
    );

    if (listingContainer) {
        listingContainer.addEventListener("click", handleListingAction);
    }

    const conversationList = $("#conversation-list");

    if (conversationList) {
        conversationList.addEventListener("click", async (event) => {
            const button = event.target.closest("[data-conversation-id]");

            if (!button) {
                return;
            }

            await openConversation(button.dataset.conversationId);
        });
    }
}

// --------------------------------------------------
// APPLICATION STARTUP
// --------------------------------------------------

async function initializeCampusLoop() {
    initializeEventListeners();
    updateAccountUI();

    try {
        if (getToken()) {
            await loadCurrentUser();

            updateAccountUI();

            connectChat();

            await loadConversations();
        }
    } catch (error) {
        console.warn("Could not restore the previous session:", error);

        localStorage.removeItem(TOKEN_KEY);

        currentUser = null;
        currentUserId = null;

        disconnectChat();
        updateAccountUI();
    }

    await loadListings();
}

document.addEventListener("DOMContentLoaded", initializeCampusLoop);