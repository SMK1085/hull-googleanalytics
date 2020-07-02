import { statusActionFactory } from "./status";
import { userUpdateHandlerFactory } from "./user-update";

export default {
  status: statusActionFactory,
  userUpdate: userUpdateHandlerFactory,
};
