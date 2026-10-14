package campus_loop.campus_loop.Entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
@Getter
@Setter
@Entity
@Table(name = "users")
public class Users {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String fullName;

    @Column(nullable = false, unique = true, length = 150)
    private String email;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false, length = 100)
    private String collegeName;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public Users() {
    }


    @PrePersist
    public void onCreate() {
        createdAt = LocalDateTime.now();
    }
}

