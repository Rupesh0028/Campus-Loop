package campus_loop.campus_loop.Service;




import campus_loop.campus_loop.DTO.ListingRequest;
import campus_loop.campus_loop.DTO.ListingResponse;
import campus_loop.campus_loop.Entity.Listing;
import campus_loop.campus_loop.Entity.Users;
import campus_loop.campus_loop.Reposistory.ListingRepository;
import campus_loop.campus_loop.Reposistory.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class ListingService {

    private final ListingRepository listingRepository;
    private final UserRepository userRepository;

    public ListingService(
            ListingRepository listingRepository,
            UserRepository userRepository) {
        this.listingRepository = listingRepository;
        this.userRepository = userRepository;
    }

    private Users findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private Listing findListing(Long id) {
        return listingRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Listing not found"));
    }

    private ListingResponse toResponse(Listing listing) {
        return new ListingResponse(
                listing.getId(),
                listing.getTitle(),
                listing.getDescription(),
                listing.getCategory(),
                listing.getPrice(),
                listing.getItemCondition(),
                listing.getCity(),
                listing.getPickupLocation(),
                listing.getStatus(),
                listing.getSeller().getFullName(),
                listing.getCreatedAt()
        );
    }

    @Transactional
    public ListingResponse create(
            ListingRequest request, String email) {

        Users seller = findUser(email);

        Listing listing = new Listing();
        listing.setTitle(request.title().trim());
        listing.setDescription(request.description());
        listing.setCategory(request.category().trim());
        listing.setPrice(request.price());
        listing.setItemCondition(request.itemCondition().trim());
        listing.setCity(request.city().trim());
        listing.setPickupLocation(request.pickupLocation());
        listing.setSeller(seller);

        return toResponse(listingRepository.save(listing));
    }

    @Transactional(readOnly = true)
    public List<ListingResponse> search(
            String keyword, String category, String city) {

        return listingRepository.searchListings(
                        normalize(keyword),
                        normalize(category),
                        normalize(city))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ListingResponse getById(Long id) {
        Listing listing = findListing(id);

        if (!"ACTIVE".equals(listing.getStatus())) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND, "Listing not found");
        }

        return toResponse(listing);
    }

    @Transactional
    public ListingResponse update(
            Long id, ListingRequest request, String email) {

        Listing listing = findListing(id);
        Users user = findUser(email);

        if (!listing.getSeller().getId().equals(user.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You cannot edit another user's listing");
        }

        listing.setTitle(request.title().trim());
        listing.setDescription(request.description());
        listing.setCategory(request.category().trim());
        listing.setPrice(request.price());
        listing.setItemCondition(request.itemCondition().trim());
        listing.setCity(request.city().trim());
        listing.setPickupLocation(request.pickupLocation());

        return toResponse(listing);
    }

    @Transactional
    public void delete(Long id, String email) {
        Listing listing = findListing(id);
        Users user = findUser(email);

        if (!listing.getSeller().getId().equals(user.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You cannot delete another user's listing");
        }

        listingRepository.delete(listing);
    }

    private String normalize(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
