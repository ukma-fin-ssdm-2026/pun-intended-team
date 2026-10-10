#!/usr/bin/env node
/**
 * MCP Server generated from OpenAPI spec for nearby-api-mcp v0.1.0
 * Generated on: 2026-10-10T14:44:07.038Z
 */

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
  type CallToolResult,
  type CallToolRequest
} from "@modelcontextprotocol/sdk/types.js";

import { z, ZodError } from 'zod';
import { jsonSchemaToZod } from 'json-schema-to-zod';
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
    description: string;
    inputSchema: any;
    method: string;
    pathTemplate: string;
    executionParameters: { name: string, in: string }[];
    requestBodyContentType?: string;
    securityRequirements: any[];
    tags?: string[];
    deprecated?: boolean;
}

/**
 * Server configuration
 */
export const SERVER_NAME = "nearby-api-mcp";
export const SERVER_VERSION = "0.1.0";
// Base URL for the API, can be set via environment variable or determined from OpenAPI spec
export const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:4100";
console.error("API_BASE_URL is set to:", API_BASE_URL);

/**
 * MCP Server instance
 */
const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
);

/**
 * Map of tool definitions by name
 */
const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([

  ["adminListCategories", {
    name: "adminListCategories",
    description: `List all categories, including inactive ones, to manage the directory. To pick a category for an event or listing, use listCategories. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/api/v1/admin/categories",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false
  }],
  ["adminCreateCategory", {
    name: "adminCreateCategory",
    description: `Add a category. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":60,"description":"Unique, case-insensitive"},"isActive":{"type":"boolean","default":true,"description":"Whether users can pick the category"}},"required":["name"],"additionalProperties":false,"description":"The JSON request body."}}},
    method: "post",
    pathTemplate: "/api/v1/admin/categories",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false
  }],
  ["adminGetCategory", {
    name: "adminGetCategory",
    description: `Get one category, including whether it is active. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Category id"}},"required":["id"]},
    method: "get",
    pathTemplate: "/api/v1/admin/categories/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false
  }],
  ["adminDeleteCategory", {
    name: "adminDeleteCategory",
    description: `Delete an unused category. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Category id"}},"required":["id"]},
    method: "delete",
    pathTemplate: "/api/v1/admin/categories/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false
  }],
  ["adminUpdateCategory", {
    name: "adminUpdateCategory",
    description: `Rename, deactivate or reactivate a category. Needs an administrator account; other accounts get 404.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Category id"},"requestBody":{"type":"object","properties":{"name":{"type":"string","minLength":1,"maxLength":60,"description":"Unique, case-insensitive"},"isActive":{"type":"boolean","description":"Whether users can pick the category"}},"additionalProperties":false,"description":"Only the fields to change"}},"required":["id"]},
    method: "patch",
    pathTemplate: "/api/v1/admin/categories/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false
  }],
  ["listCategories", {
    name: "listCategories",
    description: `List the active categories users can pick for events and listings; their ids go in categoryId. Needs an access token: a guest token or a signed-in account.
(Tags: Categories)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/api/v1/categories",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Categories"],
    deprecated: false
  }],
  ["listEvents", {
    name: "listEvents",
    description: `Browse the event catalog: published events in the catalog window, soonest first. Needs an access token: a guest token or a signed-in account.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"limit":{"type":"number","minimum":1,"maximum":20,"default":20,"description":"Items per page, at most 20"},"offset":{"type":["number","null"],"minimum":0,"default":0,"description":"Items to skip"},"categoryId":{"type":"string","format":"uuid","description":"Only events of this category"},"venueId":{"type":"string","format":"uuid","description":"Only events at this venue, e.g. after tapping its map pin"},"from":{"type":"string","format":"date","description":"First day, Kyiv time; earlier dates count as today"},"to":{"type":"string","format":"date","description":"Last day, Kyiv time; later dates count as the end of the catalog window"}}},
    method: "get",
    pathTemplate: "/api/v1/events",
    executionParameters: [{"name":"limit","in":"query"},{"name":"offset","in":"query"},{"name":"categoryId","in":"query"},{"name":"venueId","in":"query"},{"name":"from","in":"query"},{"name":"to","in":"query"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false
  }],
  ["createEvent", {
    name: "createEvent",
    description: `Publish an event. Needs a signed-in account; a guest token gets 401.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":120,"description":"Title shown in the catalog"},"description":{"type":"string","maxLength":5000,"description":"Can be empty"},"categoryId":{"type":"string","format":"uuid","description":"An active category from listCategories"},"venueId":{"type":"string","format":"uuid","description":"One of the organization's own venues"},"startsAt":{"type":"string","format":"date-time","description":"Start time with an offset, e.g. 2026-10-25T19:00:00+03:00"},"endsAt":{"type":"string","format":"date-time","description":"End time with an offset; must be after startsAt"}},"required":["title","description","categoryId","venueId","startsAt","endsAt"],"additionalProperties":false,"description":"All editable fields of an event; PUT /events/{id} takes the same body"}}},
    method: "post",
    pathTemplate: "/api/v1/events",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false
  }],
  ["getEvent", {
    name: "getEvent",
    description: `Get one event with its category and venue. Needs an access token: a guest token or a signed-in account.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Event id"}},"required":["id"]},
    method: "get",
    pathTemplate: "/api/v1/events/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false
  }],
  ["updateEvent", {
    name: "updateEvent",
    description: `Replace the editable fields of one of the organization’s own events; the body is the same as when publishing. A cancelled event cannot be edited. Needs a signed-in account; a guest token gets 401.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Event id"},"requestBody":{"type":"object","properties":{"title":{"type":"string","minLength":1,"maxLength":120,"description":"Title shown in the catalog"},"description":{"type":"string","maxLength":5000,"description":"Can be empty"},"categoryId":{"type":"string","format":"uuid","description":"An active category from listCategories"},"venueId":{"type":"string","format":"uuid","description":"One of the organization's own venues"},"startsAt":{"type":"string","format":"date-time","description":"Start time with an offset, e.g. 2026-10-25T19:00:00+03:00"},"endsAt":{"type":"string","format":"date-time","description":"End time with an offset; must be after startsAt"}},"required":["title","description","categoryId","venueId","startsAt","endsAt"],"additionalProperties":false,"description":"All editable fields of an event; PUT /events/{id} takes the same body"}},"required":["id"]},
    method: "put",
    pathTemplate: "/api/v1/events/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false
  }],
  ["cancelEvent", {
    name: "cancelEvent",
    description: `Cancel one of the organization’s own events. It stays readable with status \`cancelled\`; cancelling it again changes nothing. Needs a signed-in account; a guest token gets 401.
(Tags: Events)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Event id"}},"required":["id"]},
    method: "post",
    pathTemplate: "/api/v1/events/{id}/cancel",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Events"],
    deprecated: false
  }],
  ["listListings", {
    name: "listListings",
    description: `Browse listings: active "looking for company" posts from today on, soonest first. Needs a signed-in account; a guest token gets 401.
(Tags: Listings)`,
    inputSchema: {"type":"object","properties":{"limit":{"type":"number","minimum":1,"maximum":20,"default":20,"description":"Items per page, at most 20"},"offset":{"type":["number","null"],"minimum":0,"default":0,"description":"Items to skip"}}},
    method: "get",
    pathTemplate: "/api/v1/listings",
    executionParameters: [{"name":"limit","in":"query"},{"name":"offset","in":"query"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Listings"],
    deprecated: false
  }],
  ["createListing", {
    name: "createListing",
    description: `Post a listing. Needs a signed-in account; a guest token gets 401.
(Tags: Listings)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"categoryId":{"type":"string","format":"uuid","description":"An active category from listCategories"},"eventId":{"type":"string","format":"uuid","description":"A catalog event the listing is about"},"title":{"type":"string","minLength":1,"maxLength":120,"description":"Title shown in the listing feed"},"description":{"type":"string","maxLength":2000,"description":"Can be empty"},"date":{"type":"string","format":"date","description":"The day, Kyiv time; today or later"}},"required":["categoryId","title","description","date"],"additionalProperties":false,"description":"The JSON request body."}}},
    method: "post",
    pathTemplate: "/api/v1/listings",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Listings"],
    deprecated: false
  }],
  ["getListing", {
    name: "getListing",
    description: `Get one active listing with its author and category. Needs a signed-in account; a guest token gets 401.
(Tags: Listings)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Listing id"}},"required":["id"]},
    method: "get",
    pathTemplate: "/api/v1/listings/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Listings"],
    deprecated: false
  }],
  ["deleteListing", {
    name: "deleteListing",
    description: `Remove your listing. Needs a signed-in account; a guest token gets 401.
(Tags: Listings)`,
    inputSchema: {"type":"object","properties":{"id":{"type":"string","format":"uuid","description":"Listing id"}},"required":["id"]},
    method: "delete",
    pathTemplate: "/api/v1/listings/{id}",
    executionParameters: [{"name":"id","in":"path"}],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Listings"],
    deprecated: false
  }],
  ["listInterests", {
    name: "listInterests",
    description: `List the fixed set of interests users can pick for their profile; their ids go in interestIds. Needs a signed-in account; a guest token gets 401.
(Tags: Interests)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/api/v1/interests",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Interests"],
    deprecated: false
  }],
  ["getMyProfile", {
    name: "getMyProfile",
    description: `Get the caller’s own profile with the age computed from the account’s date of birth. \`isComplete\` is true once a communication format and at least one interest are set. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/api/v1/me/profile",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false
  }],
  ["createMyProfile", {
    name: "createMyProfile",
    description: `First onboarding step: create the caller’s profile with a username and a display name. Every later step is \`updateMyProfile\` and \`replaceMyInterests\`. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"username":{"type":"string","pattern":"^[A-Za-z0-9][A-Za-z0-9._]{2,29}$","description":"Unique, case-insensitive; 3 to 30 letters, digits, dots or underscores"},"displayName":{"type":"string","minLength":1,"maxLength":50,"description":"The name other users see"}},"required":["username","displayName"],"additionalProperties":false,"description":"The first onboarding step; everything else is added with PATCH"}}},
    method: "post",
    pathTemplate: "/api/v1/me/profile",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false
  }],
  ["updateMyProfile", {
    name: "updateMyProfile",
    description: `Change the caller’s profile: any of displayName, username, description, communicationFormat and sharePhone; only the fields sent change. Used for every later onboarding step and for the edit screen. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"displayName":{"type":"string","minLength":1,"maxLength":50,"description":"The name other users see"},"username":{"type":"string","pattern":"^[A-Za-z0-9][A-Za-z0-9._]{2,29}$","description":"Unique, case-insensitive; 3 to 30 letters, digits, dots or underscores"},"description":{"type":"string","maxLength":500,"description":"Free text about the user; can be empty"},"communicationFormat":{"type":"string","enum":["friends","dating","company"],"description":"What the user is looking for when they go to an event"},"sharePhone":{"type":"boolean","description":"Whether the phone number is revealed on a mutual match"}},"additionalProperties":false,"description":"Only the fields to change; at least one"}}},
    method: "patch",
    pathTemplate: "/api/v1/me/profile",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false
  }],
  ["replaceMyInterests", {
    name: "replaceMyInterests",
    description: `Replace the whole set of the caller’s interests with the given ids; an empty list clears it. Needs a signed-in account; a guest token gets 401.
(Tags: Profiles)`,
    inputSchema: {"type":"object","properties":{"requestBody":{"type":"object","properties":{"interestIds":{"type":"array","items":{"type":"string","format":"uuid"},"maxItems":30,"description":"Ids from listInterests; the whole set is replaced, so an empty list clears it"}},"required":["interestIds"],"additionalProperties":false,"description":"The JSON request body."}}},
    method: "put",
    pathTemplate: "/api/v1/me/profile/interests",
    executionParameters: [],
    requestBodyContentType: "application/json",
    securityRequirements: [{"bearerAuth":[]}],
    tags: ["Profiles"],
    deprecated: false
  }],
  ["getHealth", {
    name: "getHealth",
    description: `Check that the API is running. No access token needed.
(Tags: System)`,
    inputSchema: {"type":"object","properties":{}},
    method: "get",
    pathTemplate: "/health",
    executionParameters: [],
    requestBodyContentType: undefined,
    securityRequirements: [],
    tags: ["System"],
    deprecated: false
  }],
]);

/**
 * Security schemes from the OpenAPI spec
 */
const securitySchemes =   {
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "description": "An access token, or a guest token for catalog reads. Until sign-in is implemented, use a stub token: `stub-guest`, `stub-user`, `stub-user-2`, `stub-org` (verified organization), `stub-org-pending` or `stub-admin`."
    }
  };


server.setRequestHandler(ListToolsRequestSchema, async () => {
  const toolsForClient: Tool[] = Array.from(toolDefinitionMap.values()).map(def => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema
  }));
  return { tools: toolsForClient };
});


server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
  const { name: toolName, arguments: toolArgs } = request.params;
  const toolDefinition = toolDefinitionMap.get(toolName);
  if (!toolDefinition) {
    console.error(`Error: Unknown tool requested: ${toolName}`);
    return { content: [{ type: "text", text: `Error: Unknown tool requested: ${toolName}` }] };
  }
  return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, securitySchemes);
});



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
 * @returns Acquired token or null if unable to acquire
 */
async function acquireOAuth2Token(schemeName: string, scheme: any): Promise<string | null | undefined> {
    try {
        // Check if we have the necessary credentials (resolved per-scheme at runtime)
        const clientId = process.env[`OAUTH_CLIENT_ID_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
        const clientSecret = process.env[`OAUTH_CLIENT_SECRET_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
        const scopes = process.env[`OAUTH_SCOPES_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];

        if (!clientId || !clientSecret) {
            console.error(`Missing client credentials for OAuth2 scheme '${schemeName}'`);
            return null;
        }
        
        // Initialize token cache if needed
        if (typeof global.__oauthTokenCache === 'undefined') {
            global.__oauthTokenCache = {};
        }
        
        // Check if we have a cached token
        const cacheKey = `${schemeName}_${clientId}`;
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
    // Validate arguments against the input schema
    let validatedArgs: JsonObject;
    try {
        const zodSchema = getZodSchemaFromJsonSchema(definition.inputSchema, toolName);
        const argsToParse = (typeof toolArgs === 'object' && toolArgs !== null) ? toolArgs : {};
        validatedArgs = zodSchema.parse(argsToParse);
    } catch (error: unknown) {
        if (error instanceof ZodError) {
            const validationErrorMessage = `Invalid arguments for tool '${toolName}': ${error.errors.map(e => `${e.path.join('.')} (${e.code}): ${e.message}`).join(', ')}`;
            return { content: [{ type: 'text', text: validationErrorMessage }] };
        } else {
             const errorMessage = error instanceof Error ? error.message : String(error);
             return { content: [{ type: 'text', text: `Internal error during validation setup: ${errorMessage}` }] };
        }
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
    
    // Construct the full URL
    const requestUrl = API_BASE_URL ? `${API_BASE_URL}${urlPath}` : urlPath;

    // Handle request body if needed
    if (definition.requestBodyContentType && typeof validatedArgs['requestBody'] !== 'undefined') {
        requestBodyData = validatedArgs['requestBody'];
        headers['content-type'] = definition.requestBodyContentType;
    }

    // Apply security requirements if available
    // Security requirements use OR between array items and AND within each object
    const appliedSecurity = definition.securityRequirements?.find(req => {
        // Try each security requirement (combined with OR)
        return Object.entries(req).every(([schemeName, scopesArray]) => {
            const scheme = allSecuritySchemes[schemeName];
            if (!scheme) return false;
            
            // API Key security (header, query, cookie)
            if (scheme.type === 'apiKey') {
                return !!process.env[`API_KEY_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
            }
            
            // HTTP security (basic, bearer)
            if (scheme.type === 'http') {
                if (scheme.scheme?.toLowerCase() === 'bearer') {
                    return !!process.env[`BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                }
                else if (scheme.scheme?.toLowerCase() === 'basic') {
                    // Username is sufficient; an empty password is valid per RFC 7617 (issue #66)
                    return process.env[`BASIC_USERNAME_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`] != null;
                }
            }
            
            // OAuth2 security
            if (scheme.type === 'oauth2') {
                // Check for pre-existing token
                if (process.env[`OAUTH_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`]) {
                    return true;
                }
                
                // Check for client credentials for auto-acquisition
                if (process.env[`OAUTH_CLIENT_ID_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`] &&
                    process.env[`OAUTH_CLIENT_SECRET_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`]) {
                    // Verify we have a supported flow
                    if (scheme.flows?.clientCredentials || scheme.flows?.password) {
                        return true;
                    }
                }
                
                return false;
            }
            
            // OpenID Connect
            if (scheme.type === 'openIdConnect') {
                return !!process.env[`OPENID_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
            }
            
            return false;
        });
    });

    // If we found matching security scheme(s), apply them
    if (appliedSecurity) {
        // Apply each security scheme from this requirement (combined with AND)
        for (const [schemeName, scopesArray] of Object.entries(appliedSecurity)) {
            const scheme = allSecuritySchemes[schemeName];
            
            // API Key security
            if (scheme?.type === 'apiKey') {
                const apiKey = process.env[`API_KEY_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                if (apiKey) {
                    if (scheme.in === 'header') {
                        headers[scheme.name.toLowerCase()] = apiKey;
                        console.error(`Applied API key '${schemeName}' in header '${scheme.name}'`);
                    }
                    else if (scheme.in === 'query') {
                        queryParams[scheme.name] = apiKey;
                        console.error(`Applied API key '${schemeName}' in query parameter '${scheme.name}'`);
                    }
                    else if (scheme.in === 'cookie') {
                        // Add the cookie, preserving other cookies if they exist
                        headers['cookie'] = `${scheme.name}=${apiKey}${headers['cookie'] ? `; ${headers['cookie']}` : ''}`;
                        console.error(`Applied API key '${schemeName}' in cookie '${scheme.name}'`);
                    }
                }
            } 
            // HTTP security (Bearer or Basic)
            else if (scheme?.type === 'http') {
                if (scheme.scheme?.toLowerCase() === 'bearer') {
                    const token = process.env[`BEARER_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                    if (token) {
                        headers['authorization'] = `Bearer ${token}`;
                        console.error(`Applied Bearer token for '${schemeName}'`);
                    }
                } 
                else if (scheme.scheme?.toLowerCase() === 'basic') {
                    const username = process.env[`BASIC_USERNAME_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                    const password = process.env[`BASIC_PASSWORD_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                    // Empty password is valid per RFC 7617 (issue #66); only username is required.
                    if (username != null) {
                        headers['authorization'] = `Basic ${Buffer.from(`${username}:${password ?? ''}`).toString('base64')}`;
                        console.error(`Applied Basic authentication for '${schemeName}'`);
                    }
                }
            }
            // OAuth2 security
            else if (scheme?.type === 'oauth2') {
                // First try to use a pre-provided token
                let token = process.env[`OAUTH_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                
                // If no token but we have client credentials, try to acquire a token
                if (!token && (scheme.flows?.clientCredentials || scheme.flows?.password)) {
                    console.error(`Attempting to acquire OAuth token for '${schemeName}'`);
                    token = (await acquireOAuth2Token(schemeName, scheme)) ?? '';
                }
                
                // Apply token if available
                if (token) {
                    headers['authorization'] = `Bearer ${token}`;
                    console.error(`Applied OAuth2 token for '${schemeName}'`);
                    
                    // List the scopes that were requested, if any
                    const scopes = scopesArray as string[];
                    if (scopes && scopes.length > 0) {
                        console.error(`Requested scopes: ${scopes.join(', ')}`);
                    }
                }
            }
            // OpenID Connect
            else if (scheme?.type === 'openIdConnect') {
                const token = process.env[`OPENID_TOKEN_${schemeName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`];
                if (token) {
                    headers['authorization'] = `Bearer ${token}`;
                    console.error(`Applied OpenID Connect token for '${schemeName}'`);
                    
                    // List the scopes that were requested, if any
                    const scopes = scopesArray as string[];
                    if (scopes && scopes.length > 0) {
                        console.error(`Requested scopes: ${scopes.join(', ')}`);
                    }
                }
            }
        }
    } 
    // Log warning if security is required but not available
    else if (definition.securityRequirements?.length > 0) {
        // First generate a more readable representation of the security requirements
        const securityRequirementsString = definition.securityRequirements
            .map(req => {
                const parts = Object.entries(req)
                    .map(([name, scopesArray]) => {
                        const scopes = scopesArray as string[];
                        if (scopes.length === 0) return name;
                        return `${name} (scopes: ${scopes.join(', ')})`;
                    })
                    .join(' AND ');
                return `[${parts}]`;
            })
            .join(' OR ');
            
        console.warn(`Tool '${toolName}' requires security: ${securityRequirementsString}, but no suitable credentials found.`);
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
    
    // Return formatted response
    return { 
        content: [ 
            { 
                type: "text", 
                text: `API Response (Status: ${response.status}):\n${responseText}` 
            } 
        ], 
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
    
    // Return error message to client
    return { content: [{ type: "text", text: errorMessage }] };
  }
}


/**
 * Main function to start the server
 */
async function main() {
// Set up stdio transport
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
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

/**
 * Converts a JSON Schema to a Zod schema for runtime validation
 * 
 * @param jsonSchema JSON Schema
 * @param toolName Tool name for error reporting
 * @returns Zod schema
 */
function getZodSchemaFromJsonSchema(jsonSchema: any, toolName: string): z.ZodTypeAny {
    if (typeof jsonSchema !== 'object' || jsonSchema === null) { 
        return z.object({}).passthrough(); 
    }
    try {
        const zodSchemaString = jsonSchemaToZod(jsonSchema);
        const zodSchema = eval(zodSchemaString);
        if (typeof zodSchema?.parse !== 'function') { 
            throw new Error('Eval did not produce a valid Zod schema.'); 
        }
        return zodSchema as z.ZodTypeAny;
    } catch (err: any) {
        console.error(`Failed to generate/evaluate Zod schema for '${toolName}':`, err);
        return z.object({}).passthrough();
    }
}
