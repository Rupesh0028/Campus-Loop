package campus_loop.campus_loop.Controller;


import campus_loop.campus_loop.DTO.ChatMessageResponse;
import campus_loop.campus_loop.DTO.SendMessageRequest;
import campus_loop.campus_loop.Service.ConversationService;
import jakarta.validation.Valid;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Controller;
import org.springframework.messaging.handler.annotation.Payload;

import java.security.Principal;

@Controller
public class ChatWebSocketController {

    private final ConversationService conversationService;
    private final SimpMessagingTemplate messagingTemplate;

    public ChatWebSocketController(
            ConversationService conversationService,
            SimpMessagingTemplate messagingTemplate) {
        this.conversationService = conversationService;
        this.messagingTemplate = messagingTemplate;
    }

    @MessageMapping("/conversations/{conversationId}/send")
    public void sendMessage(
            @DestinationVariable Long conversationId,
            @Valid @Payload SendMessageRequest request,
            Principal principal) {

        if (principal == null) {
            throw new AccessDeniedException("Authentication required");
        }

        ChatMessageResponse saved =
                conversationService.sendMessage(
                        conversationId,
                        request,
                        principal.getName());

        messagingTemplate.convertAndSend(
                "/topic/conversations/" + conversationId,
                saved);
    }
}
