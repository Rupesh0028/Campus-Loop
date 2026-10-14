package campus_loop.campus_loop.Service;



import campus_loop.campus_loop.DTO.ChatMessageResponse;
import campus_loop.campus_loop.DTO.ConversationResponse;
import campus_loop.campus_loop.DTO.SendMessageRequest;
import campus_loop.campus_loop.Entity.ChatMessage;
import campus_loop.campus_loop.Entity.Conversation;
import campus_loop.campus_loop.Entity.Listing;
import campus_loop.campus_loop.Entity.Users;
import campus_loop.campus_loop.Reposistory.ChatMessageRepository;
import campus_loop.campus_loop.Reposistory.ConversationRepository;
import campus_loop.campus_loop.Reposistory.ListingRepository;
import campus_loop.campus_loop.Reposistory.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ConversationService {

    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository messageRepository;
    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    public ConversationService(
            ConversationRepository conversationRepository,
            ChatMessageRepository messageRepository,
            ListingRepository listingRepository,
            UserRepository userRepository) {

        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
    }

    private Users findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private Conversation findConversation(Long id) {
        return conversationRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Conversation not found"));
    }

    private boolean isParticipant(Conversation conversation, Long userId) {
        return conversation.getBuyer().getId().equals(userId)
                || conversation.getSeller().getId().equals(userId);
    }

    private void requireParticipant(Conversation conversation, Long userId) {
        if (!isParticipant(conversation, userId)) {
            // Do not reveal that another user's conversation exists.
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Conversation not found");
        }
    }

    private ConversationResponse toConversationResponse(
            Conversation conversation) {

        Listing listing = conversation.getListing();

        return new ConversationResponse(
                conversation.getId(),
                listing.getId(),
                listing.getTitle(),
                conversation.getBuyer().getId(),
                conversation.getBuyer().getFullName(),
                conversation.getSeller().getId(),
                conversation.getSeller().getFullName(),
                conversation.getCreatedAt()
        );
    }

    private ChatMessageResponse toMessageResponse(ChatMessage message) {
        return new ChatMessageResponse(
                message.getId(),
                message.getConversation().getId(),
                message.getSender().getId(),
                message.getSender().getFullName(),
                message.getContent(),
                message.getSentAt()
        );
    }

    @Transactional
    public ConversationResponse createOrGetConversation(
            Long listingId, String email) {

        Users buyer = findUser(email);

        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Listing not found"));

        if (!"ACTIVE".equals(listing.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Listing not found");
        }

        Users seller = listing.getSeller();

        if (buyer.getId().equals(seller.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "You cannot start a conversation with yourself");
        }

        Conversation conversation =
                conversationRepository
                        .findByListingIdAndBuyerId(listingId, buyer.getId())
                        .orElseGet(() -> {
                            Conversation created = new Conversation();
                            created.setListing(listing);
                            created.setBuyer(buyer);
                            created.setSeller(seller);

                            return conversationRepository.save(created);
                        });

        return toConversationResponse(conversation);
    }

    @Transactional(readOnly = true)
    public List<ConversationResponse> getMyConversations(String email) {
        Users user = findUser(email);

        return conversationRepository
                .findByBuyerIdOrSellerId(user.getId(), user.getId())
                .stream()
                .map(this::toConversationResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ChatMessageResponse> getMessages(
            Long conversationId, String email) {

        Users user = findUser(email);
        Conversation conversation = findConversation(conversationId);

        requireParticipant(conversation, user.getId());

        return messageRepository
                .findByConversation_IdOrderBySentAtAsc(conversationId)
                .stream()
                .map(this::toMessageResponse)
                .toList();
    }

    @Transactional
    public ChatMessageResponse sendMessage(
            Long conversationId,
            SendMessageRequest request,
            String email) {

        Users sender = findUser(email);
        Conversation conversation = findConversation(conversationId);

        requireParticipant(conversation, sender.getId());

        String content = request.content().trim();

        if (content.isEmpty() || content.length() > 2000) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Invalid message content");
        }

        ChatMessage message = new ChatMessage();
        message.setConversation(conversation);
        message.setSender(sender);
        message.setContent(content);

        ChatMessage saved = messageRepository.save(message);

        return toMessageResponse(saved);
    }
}
