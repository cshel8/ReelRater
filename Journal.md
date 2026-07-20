## Approved BYOA proposal

App: ReelRater

What it does: The app allows you to create an account to write reviews for movies.

Stack: Expo/React Native frontend, Node/Express API backend, Firebase Authentication, Cloud Firestore, Firebase Storage, Zustand, and AsyncStorage.

Owner: I wrote the app for a class project and potentially want to push it out to production.

Data: All of the emails/accounts/reviews are fake either created by me or someone else testing it.

AWS plan for M1: Run the Node/Express API on EC2. Use an ALB and Auto Scaling Group to manage the API instances. Use the /health route to check the instances and connect the Expo app to the ALB URL.

Approval: Instructor approved in class July 9, 2026.

## Component inventory

| Component | What it is | Cloud model | Who manages what |
| --- | --- | --- | --- |
| Expo/React Native frontend | Mobile interface where users create accounts and manage movie reviews | Client application | I manage the application code. Expo and the user's device provide the tools and runtime used to run it. |
| Node/Express API | Backend API with the health route and future profile and review routes | IaaS for M1 | I manage the API code, Node runtime, and EC2 configuration. AWS manages the physical cloud infrastructure. |
| Firebase Authentication | Handles user signup and login | Backend as a Service (BaaS) | Firebase manages the authentication service. I manage how the app uses it and which login flow is supported. |
| Cloud Firestore | Stores user profiles and movie reviews | Backend as a Service (BaaS) | Firebase manages the database service. I manage the data structure, access rules, and application data. |
| Firebase Storage | Stores profile images | Backend as a Service (BaaS) | Firebase manages the storage service. I manage file paths, access rules, and uploaded content. |
| Zustand and AsyncStorage | Stores temporary and persisted application state on the device | Local client storage | I manage the state structure and application behavior. The user's device stores the local data. |
| EC2, ALB, and Auto Scaling Group | Runs multiple API instances and distributes requests between them | Infrastructure as a Service (IaaS) | I manage the instances, launch template, scaling settings, security groups, and deployment. AWS manages the underlying hardware and managed load-balancing platform. |
| GitHub | Stores and tracks the project source code | Software as a Service (SaaS) | GitHub manages the platform. I manage the repository and its contents. |

### Future plan

This inventory describes the current M1 version of ReelRater. Firebase currently handles authentication, reviews, profiles, and image storage, while AWS hosts the Node/Express API. In future milestones, I plan to compare replacing Firebase services with AWS equivalents, including an AWS database, S3 for image storage, and Cognito for authentication. The application uses service contracts so these changes can be made without rewriting the screens.

## M1 Submission - Track B, Bring Your Own App

App:

ReelRater

Repo:

https://github.com/cshel8/ReelRater

Live backend URL:

http://reelrater-alb-1439476693.us-east-1.elb.amazonaws.com

Health check:

http://reelrater-alb-1439476693.us-east-1.elb.amazonaws.com/health

Client proof:

My screenshot shows the ReelRater login screen connecting to the AWS API through the ALB. The AWS API Status card shows that it is connected and displays which EC2 instance answered the request.

Evidence:

[State where your screenshots are saved or link/embed them here. List the approval, component inventory, EC2 deployment proof, sizing memo, ALB rotation proof, ASG self-healing proof, broken-state explanation, second-device proof, build-versus-buy write-up, and metering baseline required for your submission.]

Budget note:

After completing the load-balancing demonstration, I changed the Auto Scaling Group's desired capacity from 2 back to 1. The minimum capacity is 1 and the maximum capacity is 3. This keeps one instance available for testing while avoiding the cost of running a second instance when it is not needed.

July 15, 2026
HW 1 
Completed HW 1 other than part 2 in hw1 folder and added the screenshot in the screenshots folder. New screenshot is hw1-mfa-enabled.