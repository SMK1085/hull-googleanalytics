import { statusActionFactory } from "./status";
import { userUpdateHandlerFactory } from "./user-update";
import { userExplorerExportFactory } from "./userexplorer-export";
import { metaFieldsHandlerFactory } from "./meta-fields";
import { periodReportActionFactory } from "./periodic-report";

export default {
  status: statusActionFactory,
  userUpdate: userUpdateHandlerFactory,
  userExplorerExport: userExplorerExportFactory,
  metaFields: metaFieldsHandlerFactory,
  periodicReport: periodReportActionFactory,
};
