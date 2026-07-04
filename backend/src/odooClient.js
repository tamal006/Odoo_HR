/**
 * odooClient.js — Thin async wrapper around Odoo's XML-RPC API.
 *
 * Exposes: authenticate, searchRead, search, read, create, write, unlink, callMethod
 * All HR route code uses these helpers — never touches raw XML-RPC directly.
 *
 * Auth uses API key (not password). The uid is fetched once and cached.
 */

import xmlrpc from "xmlrpc";
import dotenv from "dotenv";

dotenv.config();

// ─── Configuration ──────────────────────────────────────────────────────────

const ODOO_URL = process.env.ODOO_URL; // e.g. "https://mycompany.odoo.com"
const ODOO_DB = process.env.ODOO_DB;
const ODOO_USERNAME = process.env.ODOO_USERNAME; // login (email or "admin")
const ODOO_API_KEY = process.env.ODOO_API_KEY; // API key (acts as password)

if (!ODOO_URL || !ODOO_DB || !ODOO_USERNAME || !ODOO_API_KEY) {
  console.error(
    "Missing Odoo env vars. Required: ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY"
  );
}

// ─── XML-RPC Client Factory ─────────────────────────────────────────────────

/**
 * Creates an XML-RPC client for the given endpoint path.
 * Handles both http and https URLs.
 */
function createClient(path) {
  const url = new URL(path, ODOO_URL);
  const isSecure = url.protocol === "https:";
  const options = {
    host: url.hostname,
    port: url.port || (isSecure ? 443 : 80),
    path: url.pathname,
  };
  return isSecure
    ? xmlrpc.createSecureClient(options)
    : xmlrpc.createClient(options);
}

const commonClient = createClient("/xmlrpc/2/common");
const objectClient = createClient("/xmlrpc/2/object");

// ─── Promise wrappers ───────────────────────────────────────────────────────

function rpcCall(client, method, params) {
  return new Promise((resolve, reject) => {
    client.methodCall(method, params, (err, value) => {
      if (err) {
        // Extract a readable message from XML-RPC faults
        const msg =
          err.faultString || err.body || err.message || "XML-RPC error";
        reject(new Error(`Odoo RPC [${method}]: ${msg}`));
      } else {
        resolve(value);
      }
    });
  });
}

// ─── UID Cache ──────────────────────────────────────────────────────────────

let _uid = null;

/**
 * Authenticate against Odoo and return the user id (uid).
 * Uses /xmlrpc/2/common → authenticate(db, login, apiKey, {}).
 * Result is cached for the lifetime of the process.
 */
async function authenticate() {
  if (_uid !== null) return _uid;

  const uid = await rpcCall(commonClient, "authenticate", [
    ODOO_DB,
    ODOO_USERNAME,
    ODOO_API_KEY,
    {},
  ]);

  if (!uid || uid === false) {
    throw new Error(
      "Odoo authentication failed — check ODOO_DB, ODOO_USERNAME, ODOO_API_KEY"
    );
  }

  _uid = uid;
  return _uid;
}

// ─── Generic execute_kw wrapper ─────────────────────────────────────────────

/**
 * Low-level wrapper for execute_kw.
 * @param {string} model   - Odoo model name (e.g. "hr.employee")
 * @param {string} method  - ORM method (e.g. "search_read")
 * @param {Array}  args    - Positional args
 * @param {Object} kwargs  - Keyword args (fields, limit, offset, order …)
 */
async function execute(model, method, args = [], kwargs = {}) {
  const uid = await authenticate();
  return rpcCall(objectClient, "execute_kw", [
    ODOO_DB,
    uid,
    ODOO_API_KEY,
    model,
    method,
    args,
    kwargs,
  ]);
}

// ─── High-level helpers ─────────────────────────────────────────────────────

/**
 * Search and read records.
 * @param {string} model
 * @param {Array}  domain  - Odoo domain filter, e.g. [['work_email','=','a@b.com']]
 * @param {Array}  fields  - Field names to return
 * @param {Object} options - { limit, offset, order }
 * @returns {Array} records
 */
async function searchRead(model, domain = [], fields = [], options = {}) {
  const kwargs = {};
  if (fields.length) kwargs.fields = fields;
  if (options.limit) kwargs.limit = options.limit;
  if (options.offset) kwargs.offset = options.offset;
  if (options.order) kwargs.order = options.order;
  return execute(model, "search_read", [domain], kwargs);
}

/**
 * Search for record IDs.
 * @returns {Array<number>} ids
 */
async function search(model, domain = [], options = {}) {
  const kwargs = {};
  if (options.limit) kwargs.limit = options.limit;
  if (options.offset) kwargs.offset = options.offset;
  if (options.order) kwargs.order = options.order;
  return execute(model, "search", [domain], kwargs);
}

/**
 * Read specific records by ID.
 * @param {string}        model
 * @param {Array<number>} ids
 * @param {Array}         fields
 * @returns {Array} records
 */
async function read(model, ids, fields = []) {
  const kwargs = {};
  if (fields.length) kwargs.fields = fields;
  return execute(model, "read", [ids], kwargs);
}

/**
 * Create a new record.
 * @param {string} model
 * @param {Object} values - field → value map
 * @returns {number} new record ID
 */
async function create(model, values) {
  return execute(model, "create", [values]);
}

/**
 * Update an existing record.
 * @param {string} model
 * @param {number} id
 * @param {Object} values
 * @returns {boolean} true on success
 */
async function write(model, id, values) {
  return execute(model, "write", [[id], values]);
}

/**
 * Delete a record.
 * @param {string} model
 * @param {number} id
 * @returns {boolean}
 */
async function unlink(model, id) {
  return execute(model, "unlink", [[id]]);
}

/**
 * Call an arbitrary Odoo method on a model (e.g. action_validate on hr.leave).
 * @param {string}        model
 * @param {string}        method
 * @param {Array<number>} ids
 * @param {Array}         args   - extra positional args after the id list
 * @returns {*} method result
 */
async function callMethod(model, method, ids = [], args = []) {
  return execute(model, method, [ids, ...args]);
}

// ─── Exports ────────────────────────────────────────────────────────────────

const odooClient = {
  authenticate,
  execute,
  searchRead,
  search,
  read,
  create,
  write,
  unlink,
  callMethod,
};

export default odooClient;
