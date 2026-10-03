// Written with the help of Claude
// Single place for the port: both the server and the generated spec use it.
export const DEFAULT_PORT = 4100;

export const port = Number(process.env.PORT ?? DEFAULT_PORT);
