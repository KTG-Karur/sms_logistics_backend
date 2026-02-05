const NodeRSA = require("node-rsa");
const CryptoJS = require("crypto-js");
const secretKey = "KtgUserpassworD@2011";
const moment = require("moment");
const FormData = require("form-data");
const nodemailer = require("nodemailer");
const { OAuth2Client } = require("google-auth-library");
const Handlebars = require("handlebars");
const fs = require("fs");
const { default: axios } = require("axios");
const {
  EMAIL_ADDRESS,
  CLIENT_ID,
  CLIENT_SECRET,
  REFRESH_TOKEN,
  RP_ORIGIN,
  PB_BASE_URL,
  PB_API_KEY,
} = process.env;

function hideMailPartially(email) {
  const [localPart, domain] = email.split("@");
  const hiddenPart =
    localPart.slice(0, 2) +
    "*".repeat(6) +
    localPart.slice(localPart.length - 2);
  return `${hiddenPart}@${domain}`;
}

const tryParseDate = (input) => {
  const possibleFormats = [
    "DD/MM/YYYY",
    "MM/DD/YYYY",
    "YYYY-MM-DD",
    "DD-MM-YYYY",
    "YYYY/MM/DD",
  ];

  for (const format of possibleFormats) {
    const parsed = moment(input, format, true); // true = strict parsing
    if (parsed.isValid()) return parsed.toDate();
  }

  return null; // if all formats fail
};

async function sendMail(toEmail, subject, planeBody, params = {}) {
  const result = new Promise((resolve, reject) => {
    try {
      const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
      oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: EMAIL_ADDRESS,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          refreshToken: REFRESH_TOKEN,
          accessToken: oAuth2Client.getAccessToken(),
        },
      });

      const mailOptions = {
        from: EMAIL_ADDRESS,
        to: toEmail,
        subject: subject,
        text: planeBody,
      };

      transport.sendMail({ ...mailOptions, ...params }, (error, info) => {
        if (error) {
          console.log(error);
          console.log("Error occurred while sending email:", error.message);
          reject(error);
        } else {
          console.log("Email sent successfully:", info.messageId);
          resolve(info);
        }
      });
    } catch (error) {
      reject(false);
    }
  });

  return result;
}

async function sendSMS(mobile_number, message, params = {}) {
  const config = {
    headers: {
      Authorization: "Bearer " + process.env.SMS_API_TOKEN,
    },
  };

  try {
    await axios
      .post(
        process.env.SMS_API_URL,
        {
          message,
          mobile_number,
        },
        config
      )
      .then((response) => {
        console.log(response.data);
      });
  } catch (error) {
    console.log(error.response);

    throw new Error("Send sms failed");
  }
}

async function sendMailTemplate(email, subject, template_name, data = {}) {
  const result = new Promise((resolve, reject) => {
    try {
      const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
      oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: {
          type: "OAuth2",
          user: EMAIL_ADDRESS,
          clientId: CLIENT_ID,
          clientSecret: CLIENT_SECRET,
          refreshToken: REFRESH_TOKEN,
          accessToken: oAuth2Client.getAccessToken(),
        },
      });

      var mailFile = fs.readFileSync(
        `./templates/mail_templates/${template_name}.html`,
        "utf-8"
      );
      var template = Handlebars.compile(mailFile);
      var mailTemplate = template({
        RP_ORIGIN,
        ...data,
      });

      const mailOptions = {
        from: EMAIL_ADDRESS,
        to: email,
        subject: subject,
        html: mailTemplate,
      };

      transport.sendMail({ ...mailOptions }, (error, info) => {
        if (error) {
          console.log("Error occurred while sending email:", error.message);
          reject(error);
        } else {
          console.log("Email sent successfully:", info.messageId);
          resolve(info);
        }
      });
    } catch (error) {
      reject(false);
    }
  });

  return result;
}

/**
 * It will convert buffer data into base64 image string.
 * @output data:image/gif;base64,R0lGODdhAQABAPAAAP8AAAAAACwAAAAAAQABAAACAkQBADs=
 * @example <img alt="red-dot" src="data:image/gif;base64,R0lGODdhAQABAPAAAP8AAAAAACwAAAAAAQABAAACAkQBADs=" />
 * @param {Array} image
 * @param {boolean} isMobile
 * @returns base64 string data
 */
function ConvertImageToString(image) {
  if (image === undefined || image === "") return null;
  if (image[0]) image = image[0];
  // @ts-ignore
  var data = image?.buffer?.toString("base64");
  // @ts-ignore
  return `data:${image?.mimetype};base64,${data}`;
}

/**
 * Convert a multer file to a FormData.
 * @param {object} image The multer file object containing binary data.
 * @returns {Uint8Array} A Promise that resolves to a FormData object.
 */
async function ConvertImageToFormData(image) {
  const imageString = await ConvertImageToString(image);
  const { data: imageFormData } = await axios.get(imageString, {
    responseType: "formdata",
  });
  return imageFormData;
}

async function uploadImageToServer(image, prefix) {
  const path = process.env.STORAGE_API_URL;
  const uploadToken = process.env.STORAGE_API_TOKEN;

  const url = new URL(`${path}/upload`);
  url.searchParams.set("token", uploadToken);

  const imageFormData = await ConvertImageToFormData(image);

  const fData = new FormData();
  fData.append("file", imageFormData, {
    contentType: image?.mimeType,
    filename: image?.originalname,
  });
  fData.append("path", prefix);

  const responseDada = await axios.postForm(url.toString(), fData);
  return responseDada;
}

const arrayOrNotToArray = (data) => {
  return data ? (Array.isArray(data) ? data : [data]) : [];
};

const ConvertTime = {
  /**
   *
   * @param {Date|string} time
   * @param {string} timeZone
   * @returns
   */
  toLocaleString: (time, timeZone = "Asia/Colombo") => {
    return new Date(time).toLocaleString("en-US", {
      timeZone,
    });
  },

  /**
   *
   * @param {Date|string} date
   * @returns {TWeekday}
   */
  toWeekDay: (date) => {
    return new Date(date)
      .toLocaleString("en-US", {
        weekday: "long",
      })
      .toUpperCase();
  },

  /**
   *
   * @param {Date|string} date
   * @returns
   */
  toYearMonth: (date) => {
    const timestamp = new Date(date);
    const yearMonth = `${timestamp.getFullYear()}${String(
      timestamp.getMonth() + 1
    ).padStart(2, "0")}`;
    return yearMonth;
  },
};

const STATUS_CODE = {
  CONTINUE: 100,
  SWITCHING_PROTOCOLS: 101,
  PROCESSING: 102,
  EARLY_HINTS: 103,
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NON_AUTHORITATIVE_INFORMATION: 203,
  NO_CONTENT: 204,
  RESET_CONTENT: 205,
  PARTIAL_CONTENT: 206,
  MULTI_STATUS: 207,
  ALREADY_REPORTED: 208,
  IM_USED: 226,
  MULTIPLE_CHOICES: 300,
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  SEE_OTHER: 303,
  NOT_MODIFIED: 304,
  USE_PROXY: 305,
  TEMPORARY_REDIRECT: 307,
  PERMANENT_REDIRECT: 308,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  PROXY_AUTHENTICATION_REQUIRED: 407,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  GONE: 410,
  LENGTH_REQUIRED: 411,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  URI_TOO_LONG: 414,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RANGE_NOT_SATISFIABLE: 416,
  EXPECTATION_FAILED: 417,
  I_M_A_TEAPOT: 418,
  MISDIRECTED_REQUEST: 421,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  FAILED_DEPENDENCY: 424,
  TOO_EARLY: 425,
  UPGRADE_REQUIRED: 426,
  PRECONDITION_REQUIRED: 428,
  TOO_MANY_REQUESTS: 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE: 431,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451,
  EXPIRED: 498,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  HTTP_VERSION_NOT_SUPPORTED: 505,
  VARIANT_ALSE_NEGOTIATES: 506,
  INSUFFICIENT_STORAGE: 507,
  LOOP_DETECTED: 508,
  BANDWIDTH_LIMIT_EXCEEDED: 509,
  NOT_EXTENDED: 510,
  NETWORK_AUTHENTIICATION_REQUIRE: 511,
};

const getRandomInteger = (multiplier = 1) => {
  return Math.round(Math.random() * multiplier);
};

const getRandomDouble = (multiplier = 1) => {
  return Math.random() * multiplier;
};

const numberToAlphabets = (x) => {
  let number = x;
  let text = "";

  while (number > 0) {
    number--;

    const remainder = number % 26;
    text = String.fromCharCode(remainder + 65) + text;
    number = Math.floor(number / 26);
  }
  return text;
};

const alphabetsToNumber = (text) => {
  let number = 0;

  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i) - 64;
    number = number * 26 + value;
  }
  return number;
};

const firstLetterCapital = (text) => {
  const firstLetter = text?.slice(0, 1);
  const followings = text?.slice(1);

  return `${firstLetter?.toLocaleUpperCase()}${followings?.toLowerCase()}`;
};

async function encrptPassword(passcode) {
  try {
    var ciphertext = CryptoJS.AES.encrypt(passcode, secretKey).toString();
    return ciphertext;
  } catch (error) {
    throw error;
  }
}

async function decrptPassword(passcode) {
  try {
    var bytes = CryptoJS.AES.decrypt(passcode, secretKey);
    var originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText;
  } catch (error) {
    throw error;
  }
}

// console.log(decrptPassword("U2FsdGVkX19NpiswBHkNJ1THku/+No3Gh/daZZyO4CQ="))

function encryptObject(obj) {
  const ciphertext = CryptoJS.AES.encrypt(
    JSON.stringify(obj),
    secretKey
  ).toString();
  return ciphertext;
}

// Decryption function
function decryptObject(encryptedData) {
  const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  return decryptedData;
}

async function prefixZeroConst(number) {
  if (number < 1000) {
    return number.toString().padStart(4, "0");
  }
  return number.toString();
}

async function dateConversion(date, format = "DD-MM-YYYY") {
  const result = date ? moment(date).format(format) : "";
  return result;
}

async function generateSerialNumber(codeFormat, count) {
  try {
    const value = parseInt(count) + parseInt(`0001`);
    const serialCount = await prefixZeroConst(value);
    const serialGenerator = codeFormat + serialCount;
    return serialGenerator;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  sendSMS,
  sendMail,
  sendMailTemplate,
  hideMailPartially,
  arrayOrNotToArray,
  numberToAlphabets,
  alphabetsToNumber,
  getRandomInteger,
  getRandomDouble,
  firstLetterCapital,
  uploadImageToServer,
  tryParseDate,
  encrptPassword,
  dateConversion,
  decrptPassword,
  encryptObject,
  generateSerialNumber,
  decryptObject,
  prefixZeroConst,
  STATUS_CODE,
};
