package campus_loop.campus_loop.DTO;



import java.time.LocalDateTime;

public record ConversationResponse(
        Long id,
        Long listingId,
        String listingTitle,
        Long buyerId,
        String buyerName,
        Long sellerId,
        String sellerName,
        LocalDateTime createdAt
) {}

