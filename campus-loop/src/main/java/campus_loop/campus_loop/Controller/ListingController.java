package campus_loop.campus_loop.Controller;


import campus_loop.campus_loop.DTO.ListingRequest;
import campus_loop.campus_loop.DTO.ListingResponse;
import campus_loop.campus_loop.Service.ListingService;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/listings")
public class ListingController {

    private final ListingService listingService;

    public ListingController(ListingService listingService) {
        this.listingService = listingService;
    }

    @GetMapping
    public List<ListingResponse> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String city) {

        return listingService.search(keyword, category, city);
    }

    @GetMapping("/{id}")
    public ListingResponse getById(@PathVariable Long id) {
        return listingService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ListingResponse create(
            @Valid @RequestBody ListingRequest request,
            @AuthenticationPrincipal String email) {

        return listingService.create(request, email);
    }

    @PutMapping("/{id}")
    public ListingResponse update(
            @PathVariable Long id,
            @Valid @RequestBody ListingRequest request,
            @AuthenticationPrincipal String email) {

        return listingService.update(id, request, email);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id,
            @AuthenticationPrincipal String email) {

        listingService.delete(id, email);
    }
}
