#!/usr/bin/env node
/**
 * MCP Server generated from OpenAPI spec for nearby-api-mcp v0.1.1
 * Generated on: 2026-11-01T10:48:47.136Z
 */

import { existsSync } from 'node:fs';

// Load environment variables from .env in the working directory, when present.
// Node's built-in loader never overrides variables that are already set and,
// unlike dotenv 17+, never writes to stdout (which would corrupt stdio servers).
if (existsSync('.env')) process.loadEnvFile('.env');

import { Server, ProtocolError, ProtocolErrorCode, type Tool, type CallToolResult, type CallToolRequest } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { Validator, type OutputUnit } from '@cfworker/json-schema';
import axios, { type AxiosRequestConfig, type AxiosError } from 'axios';

/**
 * Type definition for JSON objects
 */
type JsonObject = Record<string, any>;

/**
 * Interface for MCP Tool Definition
 */
interface McpToolDefinition {
    name: string;
    title?: string;
    description: string;
    inputSchema: any;
    method: string;
    pathTemplate: string;
    executionParameters: { name: string, in: string }[];
    requestBodyContentType?: string;
    serverUrl?: string;
    securityRequirements: any[];
    tags?: string[];
    deprecated?: boolean;
    outputSchema?: any;
    annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
}

/**
 * Server configuration
 */
export const SERVER_NAME = "nearby-api-mcp";
export const SERVER_VERSION = "0.1.1";
// Instructions sent to clients, from the OpenAPI info.description.
export const SERVER_INSTRUCTIONS = "REST API of Nearby, an app for going to events and meeting people along the way.";
// Base URL for the API, can be set via environment variable or determined from OpenAPI spec
export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4100";
console.error("API_BASE_URL is set to:", API_BASE_URL);

/**
 * Map of tool definitions by name
 */
const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([

  ["adminListCategories", {
    name: "adminListCategories",
    title: "List all categories",
    description: `List all categories, including inactive ones, to manage the directory. To pick a category for an event or listing, use listCategories. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/api/v1/admin/categories",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["adminCreateCategory", {
    name: "adminCreateCategory",
    title: "Add a category",
    description: `Add a category. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":60,"description":"Unique, case-insensitive"},"isActive":{"type":"boolean","default":true,"description":"Whether users can pick the category"}},"required":["name"],"additionalProperties":false,"examples":[{"name":"Workshops"}],"description":"The JSON request body."}}},
    method: "post",
    pathTemplate: "/api/v1/admin/categories",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}
  }],
  ["adminGetCategory", {
    name: "adminGetCategory",
    title: "Get a category",
    description: `Get one category, including whether it is active. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Category id"}},"required":["id"]},
    method: "get",
    pathTemplate: "/api/v1/admin/categories/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["adminDeleteCategory", {
    name: "adminDeleteCategory",
    title: "Delete an unused category",
    description: `Delete an unused category. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Category id"}},"required":["id"]},
    method: "delete",
    pathTemplate: "/api/v1/admin/categories/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true}
  }],
  ["adminUpdateCategory", {
    name: "adminUpdateCategory",
    title: "Rename, deactivate or reactivate a category",
    description: `Rename, deactivate or reactivate a category. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Category id"},"requestBody":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":60,"description":"Unique, case-insensitive"},"isActive":{"type":"boolean","description":"Whether users can pick the category"}},"additionalProperties":false,"description":"Only the fields to change","examples":[{"isActive":false}]}},"required":["id"]},
    method: "patch",
    pathTemplate: "/api/v1/admin/categories/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}
  }],
  ["listCategories", {
    name: "listCategories",
    title: "List the categories users can pick",
    description: `List the active categories users can pick for events and listings; their ids go in categoryId. Needs an access token: a guest token or a signed-in account.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/api/v1/categories",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["listEvents", {
    name: "listEvents",
    title: "Browse the event catalog",
    description: `Browse the event catalog: published events in the catalog window, soonest first. Needs an access token: a guest token or a signed-in account.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":20,"default":20,"description":"Items per page, at most 20"},"offset":{"type":["integer","null"],"minimum":0,"default":0,"description":"Items to skip"},"categoryId":{"type":"string","format":"uuid","description":"Only events of this category"},"venueId":{"type":"string","format":"uuid","description":"Only events at this venue, e.g. after tapping its map pin"},"from":{"type":"string","format":"date","description":"First day, Kyiv time; earlier dates count as today"},"to":{"type":"string","format":"date","description":"Last day, Kyiv time; later dates count as the end of the catalog window"}}},
    method: "get",
    pathTemplate: "/api/v1/events",
    executionParameters: [{"name":"limit","in":"query"},{"name":"offset","in":"query"},{"name":"categoryId","in":"query"},{"name":"venueId","in":"query"},{"name":"from","in":"query"},{"name":"to","in":"query"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["createEvent", {
    name: "createEvent",
    title: "Publish an event",
    description: `Publish an event. Needs a signed-in account; a guest token gets 401.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":120,"description":"Title shown in the catalog"},"description":{"type":"string","maxLength":5000,"description":"Can be empty"},"categoryId":{"type":"string","format":"uuid","description":"An active category from listCategories"},"venueId":{"type":"string","format":"uuid","description":"One of the organization's own venues"},"startsAt":{"type":"string","format":"date-time","description":"Start time with an offset, e.g. 2026-10-25T19:00:00+03:00"},"endsAt":{"type":"string","format":"date-time","description":"End time with an offset; must be after startsAt"}},"required":["title","description","categoryId","venueId","startsAt","endsAt"],"additionalProperties":false,"description":"All editable fields of an event; PUT /events/{id} takes the same body","examples":[{"title":"Film quiz night","description":"Teams of up to four, questions on Ukrainian cinema.","categoryId":"2d8b4f6c-0e3a-4c5d-9f7b-9a4c6e8d0f03","venueId":"5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05","startsAt":"2026-10-25T19:00:00+03:00","endsAt":"2026-10-25T21:00:00+03:00"}]}}},
    method: "post",
    pathTemplate: "/api/v1/events",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}
  }],
  ["getEvent", {
    name: "getEvent",
    title: "Get an event",
    description: `Get one event with its category and venue. Needs an access token: a guest token or a signed-in account.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Event id"}},"required":["id"]},
    method: "get",
    pathTemplate: "/api/v1/events/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["updateEvent", {
    name: "updateEvent",
    title: "Edit an event",
    description: `Replace the editable fields of one of the organization’s own events; the body is the same as when publishing. A cancelled event cannot be edited. Needs a signed-in account; a guest token gets 401.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Event id"},"requestBody":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":120,"description":"Title shown in the catalog"},"description":{"type":"string","maxLength":5000,"description":"Can be empty"},"categoryId":{"type":"string","format":"uuid","description":"An active category from listCategories"},"venueId":{"type":"string","format":"uuid","description":"One of the organization's own venues"},"startsAt":{"type":"string","format":"date-time","description":"Start time with an offset, e.g. 2026-10-25T19:00:00+03:00"},"endsAt":{"type":"string","format":"date-time","description":"End time with an offset; must be after startsAt"}},"required":["title","description","categoryId","venueId","startsAt","endsAt"],"additionalProperties":false,"description":"All editable fields of an event; PUT /events/{id} takes the same body","examples":[{"title":"Film quiz night","description":"Teams of up to four, questions on Ukrainian cinema.","categoryId":"2d8b4f6c-0e3a-4c5d-9f7b-9a4c6e8d0f03","venueId":"5a1c3e5f-7b9d-4f1a-8c3e-5f7a9b1d3e05","startsAt":"2026-10-25T19:00:00+03:00","endsAt":"2026-10-25T21:00:00+03:00"}]}},"required":["id"]},
    method: "put",
    pathTemplate: "/api/v1/events/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true}
  }],
  ["cancelEvent", {
    name: "cancelEvent",
    title: "Cancel an event",
    description: `Cancel one of the organization’s own events. It stays readable with status \`cancelled\`; cancelling it again changes nothing. Needs a signed-in account; a guest token gets 401.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Event id"}},"required":["id"]},
    method: "post",
    pathTemplate: "/api/v1/events/{id}/cancel",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}
  }],
  ["listListings", {
    name: "listListings",
    title: "Browse listings",
    description: `Browse listings: active "looking for company" posts from today on, soonest first. Needs a signed-in account; a guest token gets 401.
(Tags: Listings)`,
    inputSchema: {"type":"object","properties":{"limit":{"type":"integer","minimum":1,"maximum":20,"default":20,"description":"Items per page, at most 20"},"offset":{"type":["integer","null"],"minimum":0,"default":0,"description":"Items to skip"}}},
    method: "get",
    pathTemplate: "/api/v1/listings",
    executionParameters: [{"name":"limit","in":"query"},{"name":"offset","in":"query"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Listings"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["createListing", {
    name: "createListing",
    title: "Post a listing",
    description: `Post a listing. Needs a signed-in account; a guest token gets 401.
(Tags: Listings)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"categoryId":{"type":"string","format":"uuid","description":"An active category from listCategories"},"eventId":{"type":"string","format":"uuid","description":"A catalog event the listing is about"},"title":{"type":"string","minLength":1,"maxLength":120,"description":"Title shown in the listing feed"},"description":{"type":"string","maxLength":2000,"description":"Can be empty"},"date":{"type":"string","format":"date","description":"The day, Kyiv time; today or later"}},"required":["categoryId","title","description","date"],"additionalProperties":false,"examples":[{"categoryId":"1c7a3e5b-9d2f-4b4c-8e6a-8f3b5d7c9e02","eventId":"a7d4e0b2-1c3f-4b5a-8e9d-0f2c4b6a8d1e","title":"Looking for company for the Arsenal exhibition","description":"Planning to go in the evening, happy to grab a coffee after.","date":"2026-10-20"}],"description":"The JSON request body."}}},
    method: "post",
    pathTemplate: "/api/v1/listings",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Listings"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}
  }],
  ["getListing", {
    name: "getListing",
    title: "Get a listing",
    description: `Get one active listing with its author and category. Needs a signed-in account; a guest token gets 401.
(Tags: Listings)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Listing id"}},"required":["id"]},
    method: "get",
    pathTemplate: "/api/v1/listings/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Listings"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["deleteListing", {
    name: "deleteListing",
    title: "Remove your listing",
    description: `Remove your listing. Needs a signed-in account; a guest token gets 401.
(Tags: Listings)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Listing id"}},"required":["id"]},
    method: "delete",
    pathTemplate: "/api/v1/listings/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Listings"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true}
  }],
  ["listInterests", {
    name: "listInterests",
    title: "List the interests users can pick",
    description: `List the fixed set of interests users can pick for their profile; their ids go in interestIds. Needs a signed-in account; a guest token gets 401.
(Tags: Interests)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/api/v1/interests",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Interests"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["getMyProfile", {
    name: "getMyProfile",
    title: "Get your profile",
    description: `Get the caller’s own profile with the age computed from the account’s date of birth. \`isComplete\` is true once a communication format and at least one interest are set. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/api/v1/me/profile",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
  ["createMyProfile", {
    name: "createMyProfile",
    title: "Start your profile",
    description: `First onboarding step: create the caller’s profile with a username and a display name. Every later step is \`updateMyProfile\` and \`replaceMyInterests\`. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"username":{"type":"string","pattern":"^[A-Za-z0-9][A-Za-z0-9._]{2,29}$","description":"Unique, case-insensitive; 3 to 30 letters, digits, dots or underscores"},"displayName":{"type":"string","minLength":1,"maxLength":50,"description":"The name other users see"}},"required":["username","displayName"],"additionalProperties":false,"description":"The first onboarding step; everything else is added with PATCH","examples":[{"username":"olena_k","displayName":"Olena"}]}}},
    method: "post",
    pathTemplate: "/api/v1/me/profile",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":false,"idempotentHint":false,"openWorldHint":true}
  }],
  ["updateMyProfile", {
    name: "updateMyProfile",
    title: "Edit your profile",
    description: `Change the caller’s profile: any of displayName, username, description, occupation, communicationFormat and sharePhone; only the fields sent change. Used for every later onboarding step and for the edit screen. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"displayName":{"type":"string","minLength":1,"maxLength":50,"description":"The name other users see"},"username":{"type":"string","pattern":"^[A-Za-z0-9][A-Za-z0-9._]{2,29}$","description":"Unique, case-insensitive; 3 to 30 letters, digits, dots or underscores"},"description":{"type":"string","maxLength":500,"description":"Free text about the user; can be empty"},"occupation":{"type":"string","maxLength":100,"description":"What the user does, e.g. their studies or work; can be empty"},"communicationFormat":{"type":"string","enum":["friends","dating","company"],"description":"What the user is looking for when they go to an event"},"sharePhone":{"type":"boolean","description":"Whether the phone number is revealed on a mutual match"}},"additionalProperties":false,"description":"Only the fields to change; at least one","examples":[{"communicationFormat":"friends"}]}}},
    method: "patch",
    pathTemplate: "/api/v1/me/profile",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":false,"openWorldHint":true}
  }],
  ["replaceMyInterests", {
    name: "replaceMyInterests",
    title: "Set your interests",
    description: `Replace the whole set of the caller’s interests with the given ids; an empty list clears it. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"interestIds":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":30,"description":"Ids from listInterests; the whole set is replaced, so an empty list clears it"}},"required":["interestIds"],"additionalProperties":false,"examples":[{"interestIds":["b1d2c3e4-5f60-4a71-8b82-1a2b3c4d5e01"]}],"description":"The JSON request body."}}},
    method: "put",
    pathTemplate: "/api/v1/me/profile/interests",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true}
  }],
  ["replaceMyLinkedAccounts", {
    name: "replaceMyLinkedAccounts",
    title: "Set your networks",
    description: `Replace the whole set of networks (Telegram, Instagram, …) a mutual match sees, at most one per app. At least one is required, since sign-in is Google-only and there is no phone number to share. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"linkedAccounts":{"type":"array","items":{"type":"object","properties":{"network":{"type":"string","enum":["telegram","instagram","whatsapp","tiktok","facebook"],"description":"A social network whose handle a mutual match sees"},"username":{"type":"string","maxLength":200,"description":"A nickname with or without \"@\", or a profile link; for WhatsApp, a phone number"}},"required":["network","username"],"additionalProperties":false},"maxItems":5,"description":"The whole set, at most one per social network; an empty list is CONTACT_REQUIRED, since a mutual match needs a contact"}},"required":["linkedAccounts"],"additionalProperties":false,"examples":[{"linkedAccounts":[{"network":"telegram","username":"@olena_k"}]}],"description":"The JSON request body."}}},
    method: "put",
    pathTemplate: "/api/v1/me/profile/linked-accounts",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false,
    annotations: {"readOnlyHint":false,"destructiveHint":true,"idempotentHint":true,"openWorldHint":true}
  }],
  ["getHealth", {
    name: "getHealth",
    title: "Check that the API is running",
    description: `Check that the API is running. No access token needed.
(Tags: System)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/health",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [],
    tags: ["System"],
    deprecated: false,
    annotations: {"readOnlyHint":true,"openWorldHint":true}
  }],
]);

/**
 * Security schemes from the OpenAPI spec
 */
const securitySchemes =   {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT",
      "description": "An access token from `/api/v1/auth/sign-in` or `/api/v1/auth/verify`, or a guest token from `/api/v1/auth/guest` for catalog reads."
    }
  };

/** Compiled JSON Schema validators, created on first use and cached by key. */
const schemaValidators = new Map<string, Validator>();

/**
 * Returns the cached validator for a schema (JSON Schema 2020-12, all errors).
 * The validator gets its own copy because compiling annotates the schema object.
 */
function getSchemaValidator(key: string, schema: unknown): Validator {
    let validator = schemaValidators.get(key);
    if (!validator) {
        const compiled = typeof schema === 'boolean' ? schema : structuredClone(schema ?? {});
        validator = new Validator(compiled as any, '2020-12', false);
        schemaValidators.set(key, validator);
    }
    return validator;
}

/** Keywords whose errors only repeat that a nested value failed. */
const SUMMARY_KEYWORDS = new Set([
    'properties', 'patternProperties', 'additionalProperties', 'unevaluatedProperties',
    'items', 'prefixItems', 'additionalItems', 'unevaluatedItems', 'contains',
    'dependentSchemas', 'propertyNames', '$ref', '$recursiveRef', '$dynamicRef',
]);

/**
 * Formats validation errors as "<location>: <message>" joined with "; ",
 * dropping summaries that only repeat a more specific error.
 */
function formatSchemaErrors(errors: OutputUnit[]): string {
    const location = (pointer: string) => (pointer === '#' || pointer === '' ? '(root)' : pointer.replace(/^#/, ''));
    const isUnder = (pointer: string, parent: string) => pointer === parent || pointer.startsWith(parent + '/');
    const specific = errors.filter((e) => !SUMMARY_KEYWORDS.has(e.keyword) && e.keyword !== 'false');
    const kept = errors.filter((e) => {
        if (SUMMARY_KEYWORDS.has(e.keyword)) {
            return !specific.some((other) => isUnder(other.instanceLocation, e.instanceLocation));
        }
        if (e.keyword === 'false') {
            // "false" schemas reject any value, e.g. a property additionalProperties forbids.
            return !specific.some((other) => other.instanceLocation === e.instanceLocation);
        }
        return true;
    });
    const messages: string[] = [];
    for (const e of kept.length > 0 ? kept : errors) {
        const text = e.keyword === 'false' ? 'Not allowed by the schema.' : e.error;
        const message = `${location(e.instanceLocation)}: ${text}`;
        if (!messages.includes(message)) messages.push(message);
    }
    return messages.join('; ');
}

/**
 * Validates a structured result against the tool's declared output schema.
 * Returns a readable error message, or null when it conforms.
 */
function validateToolOutput(toolName: string, outputSchema: unknown, value: unknown): string | null {
    const result = getSchemaValidator(`output:${toolName}`, outputSchema).validate(value);
    return result.valid ? null : formatSchemaErrors(result.errors);
}

/**
 * Validates tool arguments against the tool's input schema. Returns a readable
 * error message, or null when they are valid. Arguments are never modified:
 * schema defaults are not injected.
 */
function validateToolArguments(toolName: string, inputSchema: unknown, args: unknown): string | null {
    const result = getSchemaValidator(`input:${toolName}`, inputSchema).validate(args);
    return result.valid ? null : `Invalid arguments for tool '${toolName}': ${formatSchemaErrors(result.errors)}`;
}

/**
 * Base URL for one operation. Without an operation or path-item server this is
 * the configured base URL (API_BASE_URL, else the spec's root server). An
 * absolute operation/path-item server is used as is, even when API_BASE_URL is
 * set; a relative one resolves against the configured base URL ("v2" appends a
 * segment, "/v2" replaces the path).
 */
function resolveOperationBaseUrl(serverUrl: string | undefined, baseUrl: string): string {
    if (!serverUrl) return baseUrl;
    const isAbsolute = (url: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
    if (isAbsolute(serverUrl)) return serverUrl.replace(/\/+$/, '');
    if (isAbsolute(baseUrl)) {
        return new URL(serverUrl, baseUrl.replace(/\/*$/, '/')).href.replace(/\/+$/, '');
    }
    // Both relative: join the paths.
    if (serverUrl.startsWith('/')) return serverUrl.replace(/\/+$/, '');
    return `${baseUrl.replace(/\/+$/, '')}/${serverUrl}`.replace(/\/+$/, '');
}

/**
 * Creates a fresh MCP server instance with the tool handlers registered.
 * Transports call this once per request, connection or era probe: an SDK server
 * instance serves exactly one transport, and the same factory backs both the
 * 2026-07-28 and 2025-era protocols.
 */
export function createServer(): Server {
  const server = new Server(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} }, instructions: SERVER_INSTRUCTIONS }
  );

server.setRequestHandler('tools/list', async () => {
  const toolsForClient: Tool[] = Array.from(toolDefinitionMap.values()).map(def => ({
    name: def.name,
    ...(def.title !== undefined && { title: def.title }),
    description: def.description,
    inputSchema: def.inputSchema,
    ...(def.outputSchema !== undefined && { outputSchema: def.outputSchema }),
    annotations: def.annotations
  }));
  return { tools: toolsForClient };
});


server.setRequestHandler('tools/call', async (request: CallToolRequest): Promise<CallToolResult> => {
  const { name: toolName, arguments: toolArgs } = request.params;
  const toolDefinition = toolDefinitionMap.get(toolName);
  if (!toolDefinition) {
    // An unknown tool is a protocol error (JSON-RPC -32602), not a tool result.
    console.error(`Error: Unknown tool requested: ${toolName}`);
    throw new ProtocolError(ProtocolErrorCode.InvalidParams, `Unknown tool: ${toolName}`);
  }
  return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, securitySchemes);
});

  return server;
}


/**
 * Type definition for cached OAuth tokens
 */
interface TokenCacheEntry {
    token: string;
    expiresAt: number;
}

/**
 * Declare global __oauthTokenCache property for TypeScript
 */
declare global {
    var __oauthTokenCache: Record<string, TokenCacheEntry> | undefined;
}

/**
 * Acquires an OAuth2 token using client credentials flow
 * 
 * @param schemeName Name of the security scheme
 * @param scheme OAuth2 security scheme
 * @param requiredScopes Scopes declared by the operation's security requirement
 * @returns Acquired token or null if unable to acquire
 */
async function acquireOAuth2Token(schemeName: string, scheme: any, requiredScopes: string[] = []): Promise<string | null | undefined> {
    try {
        // Check if we have the necessary credentials (resolved per-scheme at runtime)
        const clientId = process.env[`OAUTH_CLIENT_ID_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
        const clientSecret = process.env[`OAUTH_CLIENT_SECRET_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
        const configuredScopes = process.env[`OAUTH_SCOPES_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
        // An explicit OAUTH_SCOPES_<SCHEME> wins; otherwise request the scopes the
        // operation's security requirement declares (issue #81).
        const scopes = configuredScopes || (requiredScopes.length > 0 ? requiredScopes.join(' ') : '');

        if (!clientId || !clientSecret) {
            console.error(`Missing client credentials for OAuth2 scheme '${schemeName}'`);
            return null;
        }
        
        // Initialize token cache if needed
        if (typeof global.__oauthTokenCache === 'undefined') {
            global.__oauthTokenCache = {};
        }
        
        // Check if we have a cached token
        // Cache per scope set so a narrower token is never reused for a wider requirement.
        const cacheKey = `${schemeName}_${clientId}_${scopes}`;
        const cachedToken = global.__oauthTokenCache[cacheKey];
        const now = Date.now();
        
        if (cachedToken && cachedToken.expiresAt > now) {
            console.error(`Using cached OAuth2 token for '${schemeName}' (expires in ${Math.floor((cachedToken.expiresAt - now) / 1000)} seconds)`);
            return cachedToken.token;
        }
        
        // Determine token URL based on flow type
        let tokenUrl = '';
        if (scheme.flows?.clientCredentials?.tokenUrl) {
            tokenUrl = scheme.flows.clientCredentials.tokenUrl;
            console.error(`Using client credentials flow for '${schemeName}'`);
        } else if (scheme.flows?.password?.tokenUrl) {
            tokenUrl = scheme.flows.password.tokenUrl;
            console.error(`Using password flow for '${schemeName}'`);
        } else {
            console.error(`No supported OAuth2 flow found for '${schemeName}'`);
            return null;
        }
        
        // Prepare the token request
        let formData = new URLSearchParams();
        formData.append('grant_type', 'client_credentials');
        
        // Add scopes if specified
        if (scopes) {
            formData.append('scope', scopes);
        }

        console.error(`Requesting OAuth2 token from ${tokenUrl}`);

        // Make the token request
        const response = await axios({
            method: 'POST',
            url: tokenUrl,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
            },
            data: formData.toString()
        });
        
        // Process the response
        if (response.data?.access_token) {
            const token = response.data.access_token;
            const expiresIn = response.data.expires_in || 3600; // Default to 1 hour
            
            // Cache the token
            global.__oauthTokenCache[cacheKey] = {
                token,
                expiresAt: now + (expiresIn * 1000) - 60000 // Expire 1 minute early
            };
            
            console.error(`Successfully acquired OAuth2 token for '${schemeName}' (expires in ${expiresIn} seconds)`);
            return token;
        } else {
            console.error(`Failed to acquire OAuth2 token for '${schemeName}': No access_token in response`);
            return null;
        }
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error acquiring OAuth2 token for '${schemeName}':`, errorMessage);
        return null;
    }
}

/**
 * A credential to place on the upstream request for one security scheme.
 */
interface UpstreamCredential {
    schemeName: string;
    location: 'header' | 'query' | 'cookie';
    name: string;
    value: string;
    description: string;
}

/**
 * Outcome of resolving a tool's OpenAPI security requirements.
 */
type SecurityResolution =
    | { status: 'none' }
    | { status: 'optional' }
    | { status: 'applied'; credentials: UpstreamCredential[] }
    | { status: 'unsatisfied'; summary: string };

/**
 * Reads a per-scheme credential from the environment, e.g. API_KEY_PETSTORE_AUTH.
 */
function getSchemeEnv(prefix: string, schemeName: string): string | undefined {
    return process.env[`${prefix}_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
}

/**
 * Resolves the credential for one security scheme, or null when it is not
 * configured or cannot be obtained (for example, an OAuth2 token request failed).
 */
async function resolveSchemeCredential(
    schemeName: string,
    scheme: any,
    scopes: string[]
): Promise<UpstreamCredential | null> {
    if (!scheme) return null;

    // API Key security (header, query, cookie)
    if (scheme.type === 'apiKey') {
        const apiKey = getSchemeEnv('API_KEY', schemeName);
        if (!apiKey || !scheme.name) return null;
        const location: UpstreamCredential['location'] =
            scheme.in === 'query' ? 'query' : scheme.in === 'cookie' ? 'cookie' : 'header';
        return {
            schemeName,
            location,
            name: location === 'header' ? String(scheme.name).toLowerCase() : String(scheme.name),
            value: apiKey,
            description: `API key '${schemeName}' in ${location} '${scheme.name}'`,
        };
    }

    // HTTP security (bearer, basic)
    if (scheme.type === 'http') {
        const httpScheme = String(scheme.scheme ?? '').toLowerCase();
        if (httpScheme === 'bearer') {
            const token = getSchemeEnv('BEARER_TOKEN', schemeName);
            if (!token) return null;
            return {
                schemeName,
                location: 'header',
                name: 'authorization',
                value: `Bearer ${token}`,
                description: `Bearer token for '${schemeName}'`,
            };
        }
        if (httpScheme === 'basic') {
            const username = getSchemeEnv('BASIC_USERNAME', schemeName);
            // Empty password is valid per RFC 7617 (issue #66); only username is required.
            if (username == null) return null;
            const password = getSchemeEnv('BASIC_PASSWORD', schemeName) ?? '';
            return {
                schemeName,
                location: 'header',
                name: 'authorization',
                value: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
                description: `Basic authentication for '${schemeName}'`,
            };
        }
        return null;
    }

    // OAuth2: a pre-provided token, or client credentials for automatic acquisition
    if (scheme.type === 'oauth2') {
        let token = getSchemeEnv('OAUTH_TOKEN', schemeName);
        if (!token && (scheme.flows?.clientCredentials || scheme.flows?.password)) {
            token = (await acquireOAuth2Token(schemeName, scheme, scopes)) ?? undefined;
        }
        if (!token) return null;
        return {
            schemeName,
            location: 'header',
            name: 'authorization',
            value: `Bearer ${token}`,
            description: `OAuth2 token for '${schemeName}'${scopes.length > 0 ? ` (scopes: ${scopes.join(', ')})` : ''}`,
        };
    }

    // OpenID Connect
    if (scheme.type === 'openIdConnect') {
        const token = getSchemeEnv('OPENID_TOKEN', schemeName);
        if (!token) return null;
        return {
            schemeName,
            location: 'header',
            name: 'authorization',
            value: `Bearer ${token}`,
            description: `OpenID Connect token for '${schemeName}'`,
        };
    }

    return null;
}

/**
 * The request header a scheme's credential travels in, when it travels in one.
 */
function credentialHeaderName(scheme: any): string | undefined {
    if (!scheme) return undefined;
    if (scheme.type === 'apiKey') {
        return scheme.in === 'query' || scheme.in === 'cookie' || !scheme.name
            ? undefined
            : String(scheme.name).toLowerCase();
    }
    if (scheme.type === 'http' || scheme.type === 'oauth2' || scheme.type === 'openIdConnect') {
        return 'authorization';
    }
    return undefined;
}

/**
 * True when two credentials from one requirement would overwrite each other
 * (for example, two schemes that both need the Authorization header).
 */
function hasConflictingCredentials(credentials: UpstreamCredential[]): boolean {
    const seen = new Set<string>();
    for (const credential of credentials) {
        // Several cookies combine into one Cookie header, so they never conflict.
        if (credential.location === 'cookie') continue;
        const key = `${credential.location}:${credential.name.toLowerCase()}`;
        if (seen.has(key)) return true;
        seen.add(key);
    }
    return false;
}

/**
 * Places one resolved credential on the outgoing request.
 */
function applyUpstreamCredential(
    credential: UpstreamCredential,
    headers: Record<string, string>,
    queryParams: Record<string, any>
): void {
    if (credential.location === 'query') {
        queryParams[credential.name] = credential.value;
    } else if (credential.location === 'cookie') {
        // Add the cookie, preserving other cookies if they exist
        headers['cookie'] = `${credential.name}=${credential.value}${headers['cookie'] ? `; ${headers['cookie']}` : ''}`;
    } else {
        headers[credential.name] = credential.value;
    }
}

/**
 * Human-readable security requirements, e.g. "[apiKey AND oauth (scopes: read)] OR [bearer]".
 */
function describeSecurityRequirements(requirements: Record<string, string[]>[]): string {
    return requirements
        .map((requirement) => {
            const parts = Object.entries(requirement ?? {}).map(([name, scopes]) =>
                Array.isArray(scopes) && scopes.length > 0 ? `${name} (scopes: ${scopes.join(', ')})` : name
            );
            return `[${parts.length > 0 ? parts.join(' AND ') : 'no auth'}]`;
        })
        .join(' OR ');
}

/**
 * Environment variables (or forwarded headers) that supply one scheme's credential.
 */
function credentialHint(schemeName: string, scheme: any, passthroughNames: string[]): string {
    const suffix = schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    let hint: string;
    if (!scheme) {
        return `(security scheme '${schemeName}' is not defined in the spec)`;
    } else if (scheme.type === 'apiKey') {
        hint = `API_KEY_${suffix}`;
    } else if (scheme.type === 'http' && String(scheme.scheme ?? '').toLowerCase() === 'bearer') {
        hint = `BEARER_TOKEN_${suffix}`;
    } else if (scheme.type === 'http' && String(scheme.scheme ?? '').toLowerCase() === 'basic') {
        hint = `BASIC_USERNAME_${suffix} (and BASIC_PASSWORD_${suffix})`;
    } else if (scheme.type === 'oauth2') {
        hint = scheme.flows?.clientCredentials || scheme.flows?.password
            ? `OAUTH_TOKEN_${suffix} (or OAUTH_CLIENT_ID_${suffix} and OAUTH_CLIENT_SECRET_${suffix})`
            : `OAUTH_TOKEN_${suffix}`;
    } else if (scheme.type === 'openIdConnect') {
        hint = `OPENID_TOKEN_${suffix}`;
    } else {
        return `(security scheme '${schemeName}' of type ${scheme.type} is not supported)`;
    }
    const header = credentialHeaderName(scheme);
    return header !== undefined && passthroughNames.includes(header)
        ? `${hint} or the '${header}' request header`
        : hint;
}

/**
 * Tool error text for an operation whose security requirements cannot be met,
 * e.g. "Missing credentials for 'getPet': set API_KEY_PETSTORE_AUTH."
 */
function describeMissingCredentials(
    toolName: string,
    requirements: Record<string, string[]>[],
    allSecuritySchemes: Record<string, any>,
    passthroughNames: string[]
): string {
    const alternatives = requirements
        .filter((requirement) => Object.keys(requirement ?? {}).length > 0)
        .map((requirement) =>
            Object.keys(requirement)
                .map((schemeName) => credentialHint(schemeName, allSecuritySchemes[schemeName], passthroughNames))
                .join(' and ')
        );
    return `Missing credentials for '${toolName}': set ${alternatives.join(', or ')}. Required security: ${describeSecurityRequirements(requirements)}.`;
}

/**
 * Resolves an operation's OpenAPI security requirements (issue #81).
 *
 * Requirement objects are alternatives tried in order (OR); every scheme inside one
 * object must resolve (AND). A partially satisfied alternative is never applied, so
 * an incomplete set of credentials is never sent. An empty object ({}) makes
 * authentication optional: it is used only when no other alternative is complete.
 * A forwarded passthrough header (--header-passthrough) satisfies the scheme whose
 * credential travels in it, so a client that sends its own API key still gets the
 * other schemes of an AND requirement.
 */
async function resolveSecurityRequirements(
    requirements: Record<string, string[]>[] | undefined,
    allSecuritySchemes: Record<string, any>,
    forwarded: Record<string, string> = {}
): Promise<SecurityResolution> {
    if (!Array.isArray(requirements) || requirements.length === 0) return { status: 'none' };
    let optional = false;
    for (const requirement of requirements) {
        const entries = Object.entries(requirement ?? {});
        if (entries.length === 0) {
            optional = true;
            continue;
        }
        const credentials: UpstreamCredential[] = [];
        let complete = true;
        for (const [schemeName, scopes] of entries) {
            const headerName = credentialHeaderName(allSecuritySchemes[schemeName]);
            const credential: UpstreamCredential | null =
                headerName !== undefined && forwarded[headerName] !== undefined
                    ? {
                          schemeName,
                          location: 'header',
                          name: headerName,
                          value: forwarded[headerName],
                          description: `forwarded client header '${headerName}' for '${schemeName}'`,
                      }
                    : await resolveSchemeCredential(
                          schemeName,
                          allSecuritySchemes[schemeName],
                          Array.isArray(scopes) ? scopes : []
                      );
            if (!credential) {
                complete = false;
                break;
            }
            credentials.push(credential);
        }
        if (!complete) continue;
        if (hasConflictingCredentials(credentials)) {
            console.error(`Skipping security requirement ${describeSecurityRequirements([requirement])}: two of its schemes need the same request location.`);
            continue;
        }
        return { status: 'applied', credentials };
    }
    return optional
        ? { status: 'optional' }
        : { status: 'unsatisfied', summary: describeSecurityRequirements(requirements) };
}


/**
 * Executes an API tool with the provided arguments
 * 
 * @param toolName Name of the tool to execute
 * @param definition Tool definition
 * @param toolArgs Arguments provided by the user
 * @param allSecuritySchemes Security schemes from the OpenAPI spec
 * @returns Call tool result
 */
async function executeApiTool(
    toolName: string,
    definition: McpToolDefinition,
    toolArgs: JsonObject,
    allSecuritySchemes: Record<string, any>
): Promise<CallToolResult> {
  try {
    // Validate arguments against the tool's JSON Schema (no code generation, no eval).
    // Invalid arguments are a tool execution error the model can read and correct.
    const validatedArgs: JsonObject = (typeof toolArgs === 'object' && toolArgs !== null) ? toolArgs : {};
    const validationError = validateToolArguments(toolName, definition.inputSchema, validatedArgs);
    if (validationError) {
        return { isError: true, content: [{ type: 'text', text: validationError }] };
    }

    // Prepare URL, query parameters, headers, and request body
    let urlPath = definition.pathTemplate;
    const queryParams: Record<string, any> = {};
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    let requestBodyData: any = undefined;

    // Apply parameters to the URL path, query, or headers
    definition.executionParameters.forEach((param) => {
        const value = validatedArgs[param.name];
        if (typeof value !== 'undefined' && value !== null) {
            if (param.in === 'path') {
                urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(String(value)));
            }
            else if (param.in === 'query') {
                queryParams[param.name] = value;
            }
            else if (param.in === 'header') {
                headers[param.name.toLowerCase()] = String(value);
            }
        }
    });

    // Ensure all path parameters are resolved
    if (urlPath.includes('{')) {
        throw new Error(`Failed to resolve path parameters: ${urlPath}`);
    }
    
    // Construct the full URL (operation and path-item servers win over the base URL)
    const baseUrl = resolveOperationBaseUrl(definition.serverUrl, API_BASE_URL);
    const requestUrl = baseUrl ? `${baseUrl}${urlPath}` : urlPath;

    // Handle request body if needed
    if (definition.requestBodyContentType && typeof validatedArgs['requestBody'] !== 'undefined') {
        requestBodyData = validatedArgs['requestBody'];
        headers['content-type'] = definition.requestBodyContentType;
    }

    const forwardedHeaders: Record<string, string> = {};

    // Apply upstream credentials for this operation's security requirements
    // (OR across requirement objects, AND within one; see resolveSecurityRequirements).
    const securityResolution = await resolveSecurityRequirements(definition.securityRequirements, allSecuritySchemes, forwardedHeaders);
    if (securityResolution.status === 'applied') {
        for (const credential of securityResolution.credentials) {
            applyUpstreamCredential(credential, headers, queryParams);
            console.error(`Applied ${credential.description}`);
        }
    } else if (securityResolution.status === 'unsatisfied') {
        // Fail closed (issue #82): do not call the API without the credentials it requires,
        // unless MCP_ALLOW_MISSING_CREDENTIALS=true restores the old warn-and-send behavior.
        if (String(process.env.MCP_ALLOW_MISSING_CREDENTIALS ?? '').toLowerCase() === 'true') {
            console.warn(`Tool '${toolName}' requires security: ${securityResolution.summary}, but no complete set of credentials is configured. Sending the request without upstream credentials (MCP_ALLOW_MISSING_CREDENTIALS=true).`);
        } else {
            const message = describeMissingCredentials(toolName, definition.securityRequirements, allSecuritySchemes, []);
            console.error(message);
            return { isError: true, content: [{ type: 'text', text: message }] };
        }
    }
    

    // Prepare the axios request configuration
    const config: AxiosRequestConfig = {
      method: definition.method.toUpperCase(),
      url: requestUrl,
      params: queryParams,
      headers: headers,
      // Serialize array query params as comma-separated values (issue #41)
      paramsSerializer: (params: Record<string, any>) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value === undefined || value === null) continue;
          search.append(key, Array.isArray(value) ? value.join(',') : String(value));
        }
        return search.toString();
      },
      ...(requestBodyData !== undefined && { data: requestBodyData }),
    };

    // Log request info to stderr (doesn't affect MCP output)
    console.error(`Executing tool "${toolName}": ${config.method} ${config.url}`);

    // Execute the request
    const response = await axios(config);

    // Process and format the response
    let responseText = '';
    // Coerce header value to string before lowercasing (issue #65)
    const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
    
    // Handle JSON responses
    if (contentType.includes('application/json') && typeof response.data === 'object' && response.data !== null) {
         try { 
             responseText = JSON.stringify(response.data, null, 2); 
         } catch (e) { 
             responseText = "[Stringify Error]"; 
         }
    } 
    // Handle string responses
    else if (typeof response.data === 'string') { 
         responseText = response.data; 
    }
    // Handle other response types
    else if (response.data !== undefined && response.data !== null) { 
         responseText = String(response.data); 
    }
    // Handle empty responses
    else { 
         responseText = `(Status: ${response.status} - No body content)`; 
    }
    
    const text = `API Response (Status: ${response.status}):\n${responseText}`;

    // A JSON object response is also returned as structuredContent (text unchanged).
    const structuredContent =
        contentType.includes('application/json') &&
        typeof response.data === 'object' && response.data !== null && !Array.isArray(response.data)
            ? (response.data as Record<string, unknown>)
            : undefined;

    // With a declared outputSchema (--output-schema), never return a result that violates it.
    if (definition.outputSchema !== undefined) {
        const outputError = structuredContent === undefined
            ? 'expected a JSON object response'
            : validateToolOutput(toolName, definition.outputSchema, structuredContent);
        if (outputError) {
            return {
                isError: true,
                content: [{ type: 'text', text: `Response for tool '${toolName}' does not match its output schema: ${outputError}\n\n${text}` }],
            };
        }
    }

    return {
        content: [{ type: 'text', text }],
        ...(structuredContent !== undefined && { structuredContent }),
    };

  } catch (error: unknown) {
    // Handle errors during execution
    let errorMessage: string;
    
    // Format Axios errors specially
    if (axios.isAxiosError(error)) { 
        errorMessage = formatApiError(error); 
    }
    // Handle standard errors
    else if (error instanceof Error) { 
        errorMessage = error.message; 
    }
    // Handle unexpected error types
    else { 
        errorMessage = 'Unexpected error: ' + String(error); 
    }
    
    // Log error to stderr
    console.error(`Error during execution of tool '${toolName}':`, errorMessage);
    
    // Return the error to the client as a tool error so the model knows the call failed
    return { isError: true, content: [{ type: "text", text: errorMessage }] };
  }
}


/**
 * Main function to start the server
 */
async function main() {
// Set up stdio transport. serveStdio picks the era from the client's opening
  // message: MCP 2026-07-28 (server/discover and per-request metadata) or a
  // 2025-era initialize handshake. Each connection gets its own server instance.
  try {
    serveStdio(() => createServer(), {
      onerror: (error) => console.error('MCP stdio error:', error),
    });
    console.error(`${SERVER_NAME} MCP Server (v${SERVER_VERSION}) running on stdio${API_BASE_URL ? `, proxying API at ${API_BASE_URL}` : ''}`);
  } catch (error) {
    console.error("Error during server startup:", error);
    process.exit(1);
  }
}

/**
 * Cleanup function for graceful shutdown
 */
async function cleanup() {
    console.error("Shutting down MCP server...");
    process.exit(0);
}

// Register signal handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start the server
main().catch((error) => {
  console.error("Fatal error in main execution:", error);
  process.exit(1);
});

/**
 * Formats API errors for better readability
 * 
 * @param error Axios error
 * @returns Formatted error message
 */
function formatApiError(error: AxiosError): string {
    let message = 'API request failed.';
    if (error.response) {
        message = `API Error: Status ${error.response.status} (${error.response.statusText || 'Status text not available'}). `;
        const responseData = error.response.data;
        const MAX_LEN = 200;
        if (typeof responseData === 'string') { 
            message += `Response: ${responseData.substring(0, MAX_LEN)}${responseData.length > MAX_LEN ? '...' : ''}`; 
        }
        else if (responseData) { 
            try { 
                const jsonString = JSON.stringify(responseData); 
                message += `Response: ${jsonString.substring(0, MAX_LEN)}${jsonString.length > MAX_LEN ? '...' : ''}`; 
            } catch { 
                message += 'Response: [Could not serialize data]'; 
            } 
        }
        else { 
            message += 'No response body received.'; 
        }
    } else if (error.request) {
        message = 'API Network Error: No response received from server.';
        if (error.code) message += ` (Code: ${error.code})`;
    } else { 
        message += `API Request Setup Error: ${error.message}`; 
    }
    return message;
}
