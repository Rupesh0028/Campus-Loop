package campus_loop.campus_loop.DTO;


import java.math.BigDecimal;
import java.time.LocalDateTime;

public record ListingResponse(
        Long id,
        String title,
        String description,
        String category,
        BigDecimal price,
        String itemCondition,
        String city,
        String pickupLocation,
        String status,
        String sellerName,
        LocalDateTime createdAt
) {}

