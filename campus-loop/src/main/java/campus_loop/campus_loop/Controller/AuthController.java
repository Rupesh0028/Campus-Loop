package campus_loop.campus_loop.Controller;




import campus_loop.campus_loop.DTO.AuthResponse;
import campus_loop.campus_loop.DTO.LoginRequest;
import campus_loop.campus_loop.DTO.RegisterRequest;
import campus_loop.campus_loop.Reposistory.UserRepository;
import campus_loop.campus_loop.Service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    private final UserRepository userRepository;

    public AuthController(
            AuthService authService,
            UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> register(
            @Valid @RequestBody RegisterRequest request) {

        String message = authService.register(request);

        return Map.of("message", message);
    }
    @PostMapping("/login")
    public AuthResponse login(
            @Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/me")
    public Map<String, Object> me(
            @AuthenticationPrincipal String email) {

        var user = userRepository.findByEmail(email)
                .orElseThrow(() -> new org.springframework.web.server
                        .ResponseStatusException(
                        org.springframework.http.HttpStatus.UNAUTHORIZED));

        return Map.of(
                "id", user.getId(),
                "email", user.getEmail(),
                "fullName", user.getFullName()
        );
    }

}
