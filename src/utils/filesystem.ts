import fs from "fs";
import { reject } from "lodash";
import { resolve } from "path";

export const isDir = (path: string): boolean => {
  try {
    const result = fs.lstatSync(path).isDirectory();
    return result;
  } catch (error) {
    return false;
  }
};

export const isDirAsync = async (path: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    fs.lstat(path, (err, stats) => {
      if (err) {
        return reject(err);
      }

      return resolve(stats.isDirectory());
    });
  });
};

export const mkDir = (path: string): void => {
  fs.mkdirSync(path);
};

export const mkDirAsync = async (path: string): Promise<void> => {
  return new Promise((resolve) => {
    fs.mkdir(path, () => {
      resolve();
    });
  });
};

export const pathExists = (path: string): boolean => {
  return fs.existsSync(path);
};

export const pathExistsAsync = async (path: string): Promise<boolean> => {
  return new Promise((resolve) => {
    fs.exists(path, (exists) => resolve(exists));
  });
};

export const readJsonFromDisk = (
  path: string,
  encoding = "utf-8",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, encoding, (err, data) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return reject(err);
      }

      return resolve(JSON.parse(data));
    });
  });
};

export const readStringFromDisk = (
  path: string,
  encoding = "utf-8",
): Promise<string> => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, encoding, (err, data) => {
      if (err) {
        console.error(err);
        return reject(err);
      }

      return resolve(data);
    });
  });
};

export const saveFileToDisk = (
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any,
): Promise<boolean> => {
  return new Promise((resolve) => {
    fs.writeFile(path, content, () => {
      resolve(true);
    });
  });
};

export const deleteFileFromDisk = (path: string): Promise<unknown> => {
  return new Promise((resolve, reject) => {
    fs.unlink(path, (err) => {
      if (err) {
        console.error(err);
        return reject(err);
      }

      return resolve(true);
    });
  });
};
