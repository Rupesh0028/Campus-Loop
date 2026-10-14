package campus_loop.campus_loop.Reposistory;
import campus_loop.campus_loop.Entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationRepository
        extends JpaRepository<Conversation, Long> {

    Optional<Conversation> findByListingIdAndBuyerId(
            Long listingId, Long buyerId);

    List<Conversation> findByBuyerIdOrSellerId(
            Long buyerId, Long sellerId);
}

