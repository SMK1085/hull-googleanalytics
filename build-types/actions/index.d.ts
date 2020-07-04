/// <reference types="qs" />
/// <reference types="express" />
declare const _default: {
    status: (container: import("awilix").AwilixContainer<any>) => import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs>;
    userUpdate: (options?: any) => (ctx: any, messages: import("../types/user-update-message").default[]) => Promise<any>;
    userExplorerExport: (container: import("awilix").AwilixContainer<any>) => import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs>;
};
export default _default;
