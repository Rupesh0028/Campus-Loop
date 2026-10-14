package campus_loop.campus_loop.config;

import campus_loop.campus_loop.Entity.Conversation;
import campus_loop.campus_loop.Entity.Users;
import campus_loop.campus_loop.Reposistory.ConversationRepository;
import campus_loop.campus_loop.Reposistory.UserRepository;
import campus_loop.campus_loop.Service.JwtService;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ChatChannelInterceptor implements ChannelInterceptor {

    private static final Pattern CHAT_DESTINATION =
            Pattern.compile("/topic/conversations/(\\d+)");

    private static final Pattern SEND_DESTINATION =
            Pattern.compile("/app/conversations/(\\d+)/send");

    private final JwtService jwtService;
    private final UserRepository userRepository;
    private final ConversationRepository conversationRepository;

    public ChatChannelInterceptor(
            JwtService jwtService,
            UserRepository userRepository,
            ConversationRepository conversationRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
        this.conversationRepository = conversationRepository;
    }

    @Override
    public Message<?> preSend(
            Message<?> message, MessageChannel channel) {

        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(
                        message, StompHeaderAccessor.class);

        if (accessor == null || accessor.getCommand() == null) {
            throw new AccessDeniedException("Invalid chat message");
        }

        StompCommand command = accessor.getCommand();

        if (command == StompCommand.CONNECT) {
            authenticate(accessor);
        }

        if (command == StompCommand.SUBSCRIBE) {
            Principal principal = accessor.getUser();

            if (principal == null) {
                throw new AccessDeniedException("Authentication required");
            }

            Matcher matcher = CHAT_DESTINATION.matcher(
                    accessor.getDestination() == null
                            ? ""
                            : accessor.getDestination());

            if (!matcher.matches()) {
                throw new AccessDeniedException(
                        "Subscription destination not allowed");
            }

            Long conversationId = Long.valueOf(matcher.group(1));
            requireParticipant(conversationId, principal.getName());
        }

        if (command == StompCommand.SEND) {
            Principal principal = accessor.getUser();

            if (principal == null) {
                throw new AccessDeniedException("Authentication required");
            }

            Matcher matcher = SEND_DESTINATION.matcher(
                    accessor.getDestination() == null
                            ? ""
                            : accessor.getDestination());

            if (!matcher.matches()) {
                throw new AccessDeniedException(
                        "Message destination not allowed");
            }

            Long conversationId = Long.valueOf(matcher.group(1));
            requireParticipant(conversationId, principal.getName());
        }

        return message;
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String header = accessor.getFirstNativeHeader("Authorization");

        if (header == null || !header.startsWith("Bearer ")) {
            throw new AccessDeniedException("JWT token required");
        }

        String token = header.substring(7);

        if (!jwtService.isTokenValid(token)) {
            throw new AccessDeniedException("Invalid or expired JWT");
        }

        String email = jwtService.extractEmail(token);

        if (!userRepository.findByEmail(email).isPresent()) {
            throw new AccessDeniedException("User not found");
        }

        accessor.setUser(
                new UsernamePasswordAuthenticationToken(
                        email, null, java.util.Collections.emptyList()));
    }

    private void requireParticipant(Long conversationId, String email) {
        Users user = userRepository.findByEmail(email)
                .orElseThrow(() ->
                        new AccessDeniedException("User not found"));

        Conversation conversation =
                conversationRepository.findById(conversationId)
                        .orElseThrow(() ->
                                new AccessDeniedException(
                                        "Conversation access denied"));

        boolean isBuyer = conversation.getBuyer().getId()
                .equals(user.getId());

        boolean isSeller = conversation.getSeller().getId()
                .equals(user.getId());

        if (!isBuyer && !isSeller) {
            throw new AccessDeniedException(
                    "You are not a participant in this conversation");
        }
    }
}

