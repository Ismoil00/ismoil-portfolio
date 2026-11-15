// Shared by the server page and the client explorer. Kept out of the "use client" file:
// a server component importing a plain value from a client module gets a reference, not the value.

/** Items fetched on first render and per "Show more" click. */
export const PAGE_SIZE = 10;
