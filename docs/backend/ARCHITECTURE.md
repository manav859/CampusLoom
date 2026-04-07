# Backend Architecture

CampusLoom is a robust, security-focused backend adhering to functional partitioning for scalability.

## Feature-Based Modules (Vertical Slicing)
Instead of horizontally grouping files by architectural boundaries (i.e. one giant `controllers` folder or `routes` folder), the codebase is organized vertically around application features inside `src/modules/*`.

Each module directory aims to contain its explicit scope:
- `[module].route.js`: Fastify route registry bridging endpoints to logic.
- `[module].controller.js`: Action handlers.
- `[module].service.js`: Reusable business logic/data queries.
- `[module].schema.js`: Zod declarations defining request payloads and entity shapes.

### Benefits
- Code isolation: Updating `auth` does not affect `admissions`.
- Scalability: Easier mapping into microservices dynamically if traffic demands it.
- Autonomy: Developer boundaries are sharply drawn.

## Shared Resource Folders
Code shared globally across multiple modules should be strategically placed:
- `common/`: Primitive shared values like constants.
- `plugins/`: Instance attachments. We attach components like Mongoose/Loggers onto the global `fastify` context using plugins. 
- `middleware/`: Standard reusable intercepts (err/headers/jwt mapping).
- `utils/`: Side-effect-free, easily testable functions (e.g., standard response generation).
- `config/`: The entry `env.js` ensures our app instantly fails out at boot time using strict validations. If an incorrect URL is given or secret is missing, it crashes the app prior to startup.

## Database & Data Modeling (MongoDB)
We utilize **MongoDB** combined with the **Mongoose ODM**. This enforces strict schemas over our documents while leveraging NoSQL flexibility. 

### Modeling Paradigm
To ensure scalability without exhausting the 16MB document cap or initiating endless queries, we adopt specific indexing and mapping rules:

1. **Referencing (Foreign keys via ObjectIds)**: 
   - Used for large, unbounded collections, or independently query-heavy items. 
   - Example: `User` documents will store a referenced `RoleId`. `Audit Logs` and `Results` will exist as separate referenced collections linked via `studentId`.

2. **Embedding (Subdocuments)**:
   - Used only for tightly-coupled, highly-read smaller contexts. 
   - Example: Simple `address` fields, `permissions` arrays bound to a Role, or small `metadata` properties on Admissions (only if capped under a reasonable size limit). Avoid embedding *unbounded* lists (like every event a student attends).

All multi-tenant queries must enforce security bounds, appending a `{ schoolId: currentSchool }` filter strictly to prevent cross-tenant data bleeds.
