package campus_loop.campus_loop.DTO;


import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CreateConversationRequest(
        @NotNull @Positive Long listingId
) {}

