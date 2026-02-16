# OpenAPI

Momentum CMS auto-generates an OpenAPI (Swagger) specification from your collections.

## Swagger UI

Access the interactive API documentation at:

```
http://localhost:4200/api/docs
```

## Generated Spec

The OpenAPI spec includes:

- All collection CRUD endpoints
- Request/response schemas derived from field definitions
- Authentication requirements
- Global endpoints
- Media upload endpoints

## Customization

The spec is generated automatically from your collection configs. Field types, labels, descriptions, and required flags are all reflected in the OpenAPI schema.

## Using with API Clients

Export the spec to generate typed API clients:

```bash
# Access the raw spec
curl http://localhost:4200/api/docs/json
```

Use tools like `openapi-generator` or `swagger-codegen` to generate clients in any language.

## Related

- [REST API](rest-api.md) — Endpoint reference
- [Collection Overview](../collections/overview.md) — How collections define the schema
