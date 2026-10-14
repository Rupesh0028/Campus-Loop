package campus_loop.campus_loop.Reposistory;





import campus_loop.campus_loop.Entity.Listing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ListingRepository
        extends JpaRepository<Listing, Long> {

    @Query("""
        SELECT l FROM Listing l
        WHERE l.status = 'ACTIVE'
          AND (
              :keyword IS NULL
              OR LOWER(l.title) LIKE LOWER(CONCAT('%', :keyword, '%'))
              OR LOWER(COALESCE(l.description, ''))
                    LIKE LOWER(CONCAT('%', :keyword, '%'))
          )
          AND (
              :category IS NULL
              OR LOWER(l.category) = LOWER(:category)
          )
          AND (
              :city IS NULL
              OR LOWER(l.city) = LOWER(:city)
          )
        ORDER BY l.createdAt DESC
        """)
    List<Listing> searchListings(
            @Param("keyword") String keyword,
            @Param("category") String category,
            @Param("city") String city
    );
}

