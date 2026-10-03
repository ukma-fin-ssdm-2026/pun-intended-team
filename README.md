# Nearby

[![CI Test](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/workflows/ci.yml/badge.svg)](https://github.com/ukma-fin-ssdm-2026/pun-intended-team/actions/workflows/ci.yml)

Team project for the SSDM course at the National University of Kyiv-Mohyla Academy, 2026

## ꩜ Project description

Nearby is a particularly whimsical mobile app for going to events and meeting new people along the way.

The app collects all the upcoming events in a city: films, exhibitions, concerts, protests or workshops — anything one may need company for. A user fills in a profile (interests, age, what they are looking for: friends, dating, or just company for the evening), picks an event they would like to attend, and gets matched with someone who wants to go to the same event and shares the most interests. Users can also propose their own events if one isn't already listed.

Instead of matching first and looking for something to do second, the event is what brings people together.

Look [here](Project-Description.md) for a more detailed project description

## ໑ Team

| Member | Role | GitHub |
|---|---|---|
| Viktoriya Baran | Repo Maintainer, Quality Lead, Architecture Lead, Backend Lead, API Design Lead | [@viktoriyabaran](https://github.com/viktoriyabaran) |
| Daryna Halytska | Documentation Lead, Project Brief Lead, Data & Threat Modeler, Documentation Lead (API) | [@DarynaHalytska](https://github.com/DarynaHalytska) |
| Oleh Moshenskyi | Issue Tracker Lead, Requirements Lead, FR Lead, Requirements-Architecture Mapper, Quality Lead (API) | [@OLEGkn-coder](https://github.com/OLEGkn-coder) |
| Vladyslav Redchuk | CI Maintainer, Traceability Lead, UML Lead, Integration Lead | [@Vlad-Re](https://github.com/Vlad-Re) |

More on the team and our principles can be found [here](TeamCharter.md).

## Requirements Artifacts

Documentation related to requirements engineering for this project is located [here](docs/requirements/):

- [`requirements.md`](docs/requirements/requirements.md) — functional and non-functional requirements
- [`user-stories.md`](docs/requirements/user-stories.md) — user stories with acceptance criteria
- [`rtm.md`](docs/requirements/rtm.md) — Requirements Traceability Matrix
- [`use-cases.md`](docs/requirements/use-cases.md) — use case descriptions

## Architecture Artifacts

Documentation related to system architecture for this project is located [here](docs/architecture/):

- [`high-level-design.md`](docs/architecture/high-level-design.md) — architecture style, components and their interactions
- [`traceability-matrix.md`](docs/architecture/traceability-matrix.md) — requirements-to-components mapping
- [`data-model.md`](docs/architecture/data-model.md) — ER / domain model
- [`threat-model.md`](docs/architecture/threat-model.md) — STRIDE threat model
- [`decisions/`](docs/architecture/decisions/) — Architecture Decision Records (ADRs)
- [`uml/`](docs/architecture/uml/) — UML diagrams (component, sequence, deployment)

## API Documentation

The REST API (NestJS) is Code-First: the OpenAPI spec is generated from the zod schemas in [`src/api/`](src/api/).

- [Swagger UI on GitHub Pages](https://ukma-fin-ssdm-2026.github.io/pun-intended-team/) — read-only docs, published from `main` on every push; the page itself is [`docs/api/index.html`](docs/api/index.html), with Swagger UI vendored in [`docs/api/vendor/swagger-ui/`](docs/api/vendor/swagger-ui/)
- [`openapi-generated.yaml`](docs/api/openapi-generated.yaml) — the generated spec the page shows; regenerate and commit it with `npm run docs:generate` after changing the API
- Local Swagger UI with "Try it out": run `npm run dev` and open http://localhost:4100/api-docs

## AI Usage Note

This README was written with the participation of Claude, which drafted the initial structure and wording. The draft was reviewed and edited by Daryna Halytska and Viktoriya Baran before being committed.