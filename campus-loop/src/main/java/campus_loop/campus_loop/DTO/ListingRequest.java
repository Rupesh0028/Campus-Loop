package campus_loop.campus_loop.DTO;


import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ListingRequest(

        @NotBlank
        @Size(max = 120)
        String title,

        @Size(max = 2000)
        String description,

        @NotBlank
        @Size(max = 60)
        String category,

        @NotNull
        @DecimalMin(value = "0.01")
        BigDecimal price,

        @NotBlank
        @Size(max = 30)
        String itemCondition,

        @NotBlank
        @Size(max = 100)
        String city,

        @Size(max = 200)
        String pickupLocation

) {}

