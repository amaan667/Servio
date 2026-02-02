# ADR 0058: Glossary of Terms

## Status
Accepted

## Context
This ADR provides a comprehensive glossary of terms used throughout the Servio platform's Architecture Decision Records (ADRs) and documentation. It ensures consistent terminology and helps with understanding.

## Decision
We will maintain a comprehensive glossary of technical and business terms used in the platform. This provides:
- Consistent terminology
- Clear definitions
- Easy reference
- Better understanding
- Reduced ambiguity

### Architecture Terms

#### ADR (Architecture Decision Record)
A document that captures important architectural decisions made throughout a project's lifetime.

#### RLS (Row-Level Security)
A database security feature that restricts row-level access based on user roles and tenant context.

#### Multi-tenancy
A software architecture where a single instance of software serves multiple customers (tenants).

#### Service Layer
An architectural pattern that encapsulates business logic and provides a clean separation from API routes.

#### Repository Pattern
A design pattern that mediates between the domain and data mapping layers using a collection-like interface.

#### Unified API Handler
A consistent pattern for handling all API requests with standardized error handling and response formatting.

### Technology Terms

#### Next.js App Router
The routing system in Next.js 13+ that uses file-system-based routing with React Server Components.

#### Server Components
React components that render on the server, reducing client-side JavaScript and improving performance.

#### React Query
A library for managing server state in React applications with caching, synchronization, and background updates.

#### Supabase
An open-source Firebase alternative that provides PostgreSQL database, authentication, real-time subscriptions, and storage.

#### Radix UI
An unstyled, accessible component library for building accessible React applications.

#### shadcn/ui
A collection of re-usable components built with Radix UI and Tailwind CSS that can be copied into your project.

#### TypeScript
A typed superset of JavaScript that adds static type checking and enhanced tooling.

#### Vitest
A blazing fast unit test framework powered by Vite.

#### Playwright
An end-to-end testing framework for modern web apps.

#### Sentry
An error tracking and performance monitoring platform for applications.

#### Stripe
A payment processing platform that provides APIs for accepting payments online.

#### Redis
An in-memory data structure store, used as a database, cache, message broker, and queue.

#### PostgreSQL
A powerful, open-source object-relational database system.

### Business Terms

#### KDS (Kitchen Display System)
A digital system that displays orders in the kitchen for restaurant staff.

#### POS (Point of Sale)
A system where customers make payments for goods or services.

#### QR Code
A machine-readable optical label that contains information about the item to which it is attached.

#### Tier-based Pricing
A pricing model where customers pay different amounts based on the features and resources they need.

#### SaaS (Software as a Service)
A software licensing and delivery model in which software is licensed on a subscription basis.

#### API (Application Programming Interface)
A set of rules and protocols for building and interacting with software applications.

#### SDK (Software Development Kit)
A collection of software development tools in one installable package.

#### Webhook
A method for an application to provide real-time information to other applications.

#### OAuth
An open standard for access delegation, commonly used as a way for users to grant websites or applications access to their information.

#### JWT (JSON Web Token)
A compact, URL-safe means of representing claims to be transferred between two parties.

#### CSRF (Cross-Site Request Forgery)
An attack that forces an end user to execute unwanted actions on a web application in which they're currently authenticated.

#### XSS (Cross-Site Scripting)
A security vulnerability that allows attackers to inject malicious scripts into web pages viewed by other users.

#### SQL Injection
A code injection technique that might destroy your database or expose sensitive information.

#### GDPR (General Data Protection Regulation)
A regulation in EU law on data protection and privacy.

#### PCI DSS (Payment Card Industry Data Security Standard)
A set of requirements intended to ensure that all companies that process, store, or transmit credit card information maintain a secure environment.

#### ESG (Environmental, Social, and Governance)
A set of standards for a company's operations in three categories: environmental, social, and governance.

#### RTO (Recovery Time Objective)
The target time to restore a business process or system to an acceptable level of service after a disruption.

#### RPO (Recovery Point Objective)
The maximum acceptable amount of data loss measured in time.

#### SLA (Service Level Agreement)
A commitment between a service provider and a customer.

#### ROI (Return on Investment)
A performance measure used to evaluate the efficiency or profitability of an investment.

#### CAC (Customer Acquisition Cost)
The cost associated with convincing a customer to buy a product or service.

#### LTV (Lifetime Value)
The total revenue a business can expect from a single customer account.

#### Churn Rate
The percentage of customers who stop using a product or service during a given time period.

#### NPS (Net Promoter Score)
A metric used in customer experience programs that measures the likelihood of customers to recommend a company's products or services.

#### MRR (Monthly Recurring Revenue)
The predictable revenue generated by a business from all active subscriptions in a particular month.

#### ARR (Annual Recurring Revenue)
A key metric used by subscription-based businesses that measures the value of the contracted recurring revenue normalized for a single calendar year.

### Development Terms

#### CI/CD (Continuous Integration/Continuous Deployment)
A practice where developers merge their code changes to a central repository multiple times a day, and automated builds and tests are run.

#### Pull Request (PR)
A proposed change to a codebase that can be reviewed and discussed before being merged.

#### Branch
A parallel version of a repository where new development takes place.

#### Commit
A record of changes made to the codebase at a specific point in time.

#### Merge
The action of combining two or more sets of changes into a single set of changes.

#### Deployment
The process of making a software application available for use.

#### Rollback
The process of reverting a deployment to a previous version.

#### Canary Deployment
A technique that reduces the risk of introducing a new software version by rolling it out gradually to a small subset of users.

#### Blue-Green Deployment
A technique that reduces downtime by having two identical production environments, only one of which serves live traffic at any time.

#### Hot Module Replacement (HMR)
A feature in some module bundlers that allows modules to be replaced without a full page refresh.

#### Tree Shaking
A dead code elimination technique that removes unused code from the final bundle.

#### Code Splitting
A technique where code is split into smaller bundles that can be loaded on demand.

#### Lazy Loading
A design pattern that defers initialization of an object until it is needed.

#### Prefetching
The act of fetching and caching resources before they are needed.

#### Bundle Size
The total size of all files that make up a web application.

#### Performance Budget
A limit set on the performance metrics of a web application to ensure good user experience.

#### Core Web Vitals
A set of standardized metrics that help developers understand user experience across the web.

#### LCP (Largest Contentful Paint)
The time it takes for the largest content element to become visible.

#### FID (First Input Delay)
The time from when a user first interacts with a page to when the browser is able to begin processing the response.

#### CLS (Cumulative Layout Shift)
A metric that measures the amount of layout shift that occurs during the loading of a page.

#### TBT (Total Blocking Time)
The total amount of time between FCP and when the page is fully interactive.

#### TTI (Time to Interactive)
The time it takes for the page to become fully interactive.

### Security Terms

#### Authentication
The process of verifying the identity of a user or device.

#### Authorization
The process of determining what permissions an authenticated user has.

#### RBAC (Role-Based Access Control)
A method of regulating access to computer or network resources based on the roles of individual users within an organization.

#### 2FA (Two-Factor Authentication)
A security measure that requires two different forms of identification.

#### MFA (Multi-Factor Authentication)
A security measure that requires multiple forms of identification.

#### WebAuthn
A web standard published by the W3C that allows websites to authenticate users using public-key cryptography.

#### API Key
A unique identifier used to authenticate a user, developer, or program calling an API.

#### Session
A period of interaction between a user and a system.

#### Token
A piece of data that bears no meaning to the system but is used to identify a user or session.

#### Hash
A function that converts data of arbitrary size to a fixed-size value.

#### Encryption
The process of encoding information in such a way that only authorized parties can read it.

#### Salt
Random data that is used as an additional input to a one-way function that hashes data, passwords, or passphrases.

#### Audit Trail
A security-relevant chronological record set of records that provide documentary evidence of the sequence of activities.

#### Penetration Testing
A simulated cyberattack against your computer system to check for exploitable vulnerabilities.

#### Vulnerability Scan
An automated process that identifies security weaknesses in a computer system.

### Monitoring Terms

#### APM (Application Performance Monitoring)
The practice of monitoring software applications to ensure they perform as expected.

#### Uptime
The amount of time that a service is available and operational.

#### Downtime
The period of time when a service is unavailable.

#### Error Rate
The frequency at which errors occur in a system.

#### Response Time
The time it takes for a system to respond to a request.

#### Throughput
The amount of data that can be processed in a given amount of time.

#### Latency
The delay before a transfer of data begins following an instruction for its transfer.

#### Log Aggregation
The process of collecting logs from multiple sources into a single, centralized location.

#### Distributed Tracing
A method of tracking requests as they travel through distributed systems.

#### Alert
A notification that is triggered when a specific condition is met.

#### Dashboard
A visual display of key performance indicators and metrics.

#### Metric
A standard of measurement.

#### KPI (Key Performance Indicator)
A quantifiable measure used to evaluate the success of an organization or of a particular activity.

### Testing Terms

#### Unit Testing
A software testing method where individual units of source code are tested to determine whether they are fit for use.

#### Integration Testing
A software testing method where individual software modules are combined and tested as a group.

#### E2E Testing (End-to-End Testing)
A software testing method that tests the complete flow of an application from start to finish.

#### Regression Testing
A type of software testing that seeks to uncover new software bugs, or regressions, in existing functional areas.

#### Visual Regression Testing
A type of software testing that compares the visual appearance of a software application before and after a change.

#### Contract Testing
A software testing method that verifies that the software meets the requirements specified in a contract.

#### Load Testing
A type of software testing that simulates real-world usage of a software application.

#### Stress Testing
A type of software testing that evaluates the stability of a system under extreme conditions.

#### Chaos Testing
A method of testing a system's resilience by intentionally introducing failures.

#### Mutation Testing
A type of software testing that involves modifying a program's source code in small ways to see if existing tests catch the bugs.

#### Coverage
The percentage of code that is executed during testing.

#### Mock
A simulated object that mimics the behavior of a real object in a controlled way.

#### Stub
A small piece of code that substitutes another component during testing.

#### Test Double
A situation where a test passes when it should fail, or fails when it should pass.

#### Flaky Test
A test that sometimes passes and sometimes fails for reasons that seem random.

## References
- [Glossary Best Practices](https://www.writethedocs.org/guide/writing/documentation/start-here/glossaries/)
- [Technical Terms](https://www.techterms.com/)
