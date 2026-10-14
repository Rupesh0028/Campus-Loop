package campus_loop.campus_loop.Controller;


import campus_loop.campus_loop.DTO.ChatMessageResponse;
import campus_loop.campus_loop.DTO.ConversationResponse;
import campus_loop.campus_loop.DTO.CreateConversationRequest;
import campus_loop.campus_loop.DTO.SendMessageRequest;
import campus_loop.campus_loop.Service.ConversationService;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ConversationResponse createConversation(
            @Valid @RequestBody CreateConversationRequest request,
            @AuthenticationPrincipal String email) {

        return conversationService.createOrGetConversation(
                request.listingId(), email);
    }

    @GetMapping
    public List<ConversationResponse> getMyConversations(
            @AuthenticationPrincipal String email) {

        return conversationService.getMyConversations(email);
    }

    @GetMapping("/{id}/messages")
    public List<ChatMessageResponse> getMessages(
            @PathVariable Long id,
            @AuthenticationPrincipal String email) {

        return conversationService.getMessages(id, email);
    }

    @PostMapping("/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public ChatMessageResponse sendMessage(
            @PathVariable Long id,
            @Valid @RequestBody SendMessageRequest request,
            @AuthenticationPrincipal String email) {

        return conversationService.sendMessage(id, request, email);
    }
}

