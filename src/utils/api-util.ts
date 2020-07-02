import _ from "lodash";
import { ApiResultObject, ApiMethod } from "../core/service-objects";
import { GaxiosError, GaxiosResponse } from "gaxios";

export class ApiUtil {
  /**
   * Handles errors of an API operation and creates an appropriate result.
   *
   * @static
   * @template T The type of data.
   * @param {string} url The url of the API endpoint
   * @param {ApiMethod} method The API method.
   * @param {T} payload The payload data with which the API endpoint has been invoked.
   * @param {GaxiosError} error The error thrown by the invocation of the API.
   * @returns {ApiResultObject<T>} An API result with the properly formatted error messages.
   * @memberof ErrorUtil
   */
  public static handleApiResultError<T, undefined>(
    url: string,
    method: ApiMethod,
    payload: T,
    error: GaxiosError,
  ): ApiResultObject<T, undefined> {
    const apiResult: ApiResultObject<T, undefined> = {
      data: undefined,
      endpoint: url,
      error: error.message,
      method,
      record: payload,
      success: false,
      errorDetails: error,
    };

    return apiResult;
  }

  /**
   * Creates a properly composed API result object based on the axios response.
   *
   * @static
   * @template T The type of data.
   * @param {string} url The url of the API endpoint
   * @param {ApiMethod} method The API method.
   * @param {T} payload The payload data with which the API endpoint has been invoked.
   * @param {GaxiosResponse} gaxiosResponse The response returned from Gaxios.
   * @returns {ApiResultObject<T>} A properly composed API result object.
   * @memberof ApiUtil
   */
  public static handleApiResultSuccess<T, U>(
    url: string,
    method: ApiMethod,
    payload: T,
    gaxiosResponse: GaxiosResponse<U>,
  ): ApiResultObject<T, U> {
    const apiResult: ApiResultObject<T, U> = {
      data: gaxiosResponse.data,
      endpoint: url,
      error:
        gaxiosResponse.status >= 400 ? gaxiosResponse.statusText : undefined,
      method,
      record: payload,
      success: gaxiosResponse.status < 400,
    };

    return apiResult;
  }
}
