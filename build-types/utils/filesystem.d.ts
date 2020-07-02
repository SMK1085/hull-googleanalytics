export declare const isDir: (path: string) => boolean;
export declare const isDirAsync: (path: string) => Promise<boolean>;
export declare const mkDir: (path: string) => void;
export declare const mkDirAsync: (path: string) => Promise<void>;
export declare const pathExists: (path: string) => boolean;
export declare const pathExistsAsync: (path: string) => Promise<boolean>;
export declare const readJsonFromDisk: (path: string, encoding?: string) => Promise<any>;
export declare const saveFileToDisk: (path: string, content: any) => Promise<boolean>;
