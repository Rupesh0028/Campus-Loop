CampusLoop – Student-to-Student Marketplace
CampusLoop is a student-to-student marketplace designed to help students across colleges buy and sell used textbooks, calculators, electronics, lab equipment, and other academic essentials.
Features
User authentication: Registration and login using JWT-based authentication.
Secure APIs: Spring Security protects endpoints that require authentication.
Marketplace listings: Create, view, search, update, and delete listings, subject to the backend implementation.
Search and discovery: Find listings by keyword, category, and city.
Database persistence: Store users and marketplace listings in MySQL.
Responsive frontend: Built with HTML, CSS, and JavaScript.
Real-time chat: Planned feature; complete and test the WebSocket/STOMP backend before marking it as available.
Technology Stack
Layer	Technologies
Frontend	HTML, CSS, JavaScript
Backend	Java 21, Spring Boot
Security	Spring Security, JWT
Database	MySQL
Persistence	Spring Data JPA / Hibernate
Build tool	Maven
Real-time communication	WebSocket/STOMP (planned until implemented and tested)
Project Structure
The exact structure may vary as the project develops. A typical layout is:
```text
CampusLoop/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── src/
│   └── main/
│       ├── java/com/campusloop/
│       │   ├── config/
│       │   ├── controller/
│       │   ├── dto/
│       │   ├── entity/
│       │   ├── repository/
│       │   └── service/
│       └── resources/
│           └── application.properties
├── pom.xml
└── mvnw.cmd
```
Prerequisites
Install the following before running the application:
Java Development Kit (JDK) 21
MySQL Server
Maven, or use the Maven Wrapper if included
Visual Studio Code or another Java IDE
A browser
Database Setup
Start MySQL.
Create the database:
```sql
CREATE DATABASE campusloop;
```
Configure your local database credentials in `application.properties` or through environment variables. Do not commit real passwords or secrets to Git.
Example configuration:
```properties
spring.application.name=campus-loop
spring.datasource.url=jdbc:mysql://localhost:3306/campusloop
spring.datasource.username=${DB_USERNAME:root}
spring.datasource.password=${DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=update
spring.jpa.show-sql=true
server.port=8080
```
Use the properties required by your actual Spring Boot configuration. If JWT is enabled, configure its secret securely using an environment variable as well.
Running the Backend
From the project root, set the required environment variables in PowerShell:
```powershell
$env:DB_PASSWORD="your-local-mysql-password"
$env:JWT_SECRET="your-long-random-development-secret"
```
If your configuration uses `DB_USERNAME`, set it too:
```powershell
$env:DB_USERNAME="root"
```
Compile the project:
```powershell
.\mvnw.cmd clean compile
```
Run the application:
```powershell
.\mvnw.cmd spring-boot:run
```
If the Maven Wrapper is unavailable, use an installed Maven version:
```powershell
mvn clean compile
mvn spring-boot:run
```
The backend is expected to run at:
```text
http://localhost:8080
```
Running the Frontend
Open the `frontend` folder in Visual Studio Code.
Run `index.html` using the Live Server extension.
Confirm the frontend API URL in `app.js` matches the backend URL.
Ensure CORS settings in the backend allow the frontend's local origin.
The frontend commonly runs at `http://127.0.0.1:5500` when using Live Server.
API Overview
These are the expected API routes based on the current project design. Verify each route against the actual controller implementation.
Method	Endpoint	Purpose
POST	`/api/auth/register`	Register a user
POST	`/api/auth/login`	Log in and obtain a JWT
GET	`/api/auth/me`	Get the authenticated user's details
GET	`/api/listings`	Search and retrieve listings
GET	`/api/listings/{id}`	Retrieve a listing
POST	`/api/listings`	Create a listing
PUT	`/api/listings/{id}`	Update a listing
DELETE	`/api/listings/{id}`	Delete a listing
Conversation and WebSocket routes should be documented here once the chat backend has been implemented and tested.
Security Notes
Never commit database passwords, JWT secrets, or private credentials.
Use a strong, randomly generated JWT secret outside local development.
Keep protected API endpoints authenticated.
Validate listing and user input on the backend.
Check listing ownership before allowing updates or deletion.
Restrict conversations and messages to their participants.
Use HTTPS and appropriate production settings before deployment.
Current Development Status
CampusLoop is under development. Authentication and marketplace functionality should be tested end to end before release. Real-time chat, deployment, and any other unfinished features should only be marked complete after implementation and verification.
Future Enhancements
Complete WebSocket/STOMP real-time messaging
Favorites and listing reports
Student or college verification
Deployment to a production hosting platform
Additional search and filtering options
Author
Developed as a student software project to make exchanging academic essentials easier across colleges.

<img width="1900" height="865" alt="image" src="https://github.com/user-attachments/assets/c0aae32e-95f9-4f6d-a015-e552e76cd341" />
<img width="1919" height="891" alt="image" src="https://github.com/user-attachments/assets/3e06cd11-8f89-4e6b-9dc3-5f14651f12bb" />
<img width="1919" height="896" alt="image" src="https://github.com/user-attachments/assets/ea5925fa-7a7c-47c8-974b-e54b27d51339" />


