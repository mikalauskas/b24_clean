const fs = require('node:fs/promises');
const path = require('path');
const { stringSimilarity } = require('string-similarity-js');

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Group array of objects by the specified key
 * @date 2/18/2024 - 2:00:41 PM
 * @param {Array} array
 * @param {String} key
 * @returns {Array}
 */
const groupArrayByKey = (array, key) => {
  return array.reduce((result, obj) => {
    const keyValue = obj[key];

    if (!result[keyValue]) {
      result[keyValue] = [];
    }

    result[keyValue].push(obj);

    return result;
  }, {});
};

/**
 * Merge arrays of objects with one common property key
 * @param {Array} array1 array1
 * @param {Array} array2 array2
 * @param {String} commonProperty string
 */
const mergeArrays = (array1, array2, commonProperty) => {
  return array1.map((item1) => {
    const matchingItems = array2.filter(
      (item2) => item2[commonProperty] === item1[commonProperty],
    );

    // If there is a match, merge the objects
    if (matchingItems.length > 0) {
      let mergedList;
      matchingItems.forEach((item3) => {
        mergedList = Object.assign(item1, item3);
      });

      return mergedList;
    }

    // If there is no match, return the original object from array1
    return item1;
  });
};

/**
 * Merge arrays of objects with one common property key
 * @param {Array} array1 array1
 * @param {Array} array2 array2
 * @param {String} commonProperty1 string
 * @param {String} commonProperty2 string
 */
const mergeArraysDiff = (array1, array2, commonProperty1, commonProperty2) => {
  return array1.map((item1) => {
    const matchingItems = array2.filter(
      (item2) => item2[commonProperty2] === item1[commonProperty1],
    );

    // If there is a match, merge the objects
    if (matchingItems.length > 0) {
      let mergedList;
      matchingItems.forEach((item3) => {
        mergedList = Object.assign(item1, item3);
      });

      return mergedList;
    }

    // If there is no match, return the original object from array1
    return item1;
  });
};

/**
 * Uses string-similarity-js lib.  Merge arrays of objects with 2 common properties wich similar to 0.95 and more
 * @param {Array} array1 array1
 * @param {Array} array2 array2
 * @param {String} commonProperty1 string
 * @param {String} commonProperty2 string
 */
const mergeArraysUsingSimilarity = (array1, array2, commonProperty1, commonProperty2) => {
  return array1.map((item1) => {
    const matchingItems = array2.filter((item2) => {
      if (item1[commonProperty1] && item2[commonProperty2]) {
        const similarity = stringSimilarity(
          item1[commonProperty1],
          item2[commonProperty2],
        );

        if (similarity > 0.95) return true;
        return false;
      }
    });

    // If there is a match, merge the objects
    if (matchingItems.length > 0) {
      let mergedList;
      matchingItems.forEach((item3) => {
        mergedList = Object.assign(item1, item3);
      });

      return mergedList;
    }

    // If there is no match, return the original object from array1
    return item1;
  });
};

const writeToJsonBOM = async (filename, data) => {
  if (data) {
    console.log(`Writing data to ${filename}`);
    try {
      await fs.writeFile(
        filename,
        '\ufeff' + JSON.stringify(data, null, 2).replace(/\n/g, '\r\n'),
      );
      console.log(`Data written to file ${filename}`);
    } catch (err) {
      console.error(`Error writing to file ${filename}:`, err);
    }
  }
};

/**
 * Dump array to json
 * @date 2/20/2024 - 2:04:58 PM
 * @param {Array} data array
 * @param {String} filename string
 * @async
 */
const writeToJson = async (filename, data) => {
  if (data) {
    console.log(`Writing data to ${filename}`);
    try {
      await fs.writeFile(filename, JSON.stringify(data, null, 2));
      console.log(`Data written to file ${filename}`);
    } catch (err) {
      console.error(`Error writing to file ${filename}:`, err);
    }
  }
};

const stringToISODate = (date) => {
  if (!date) return null;
  const [datePart, timePart] = date.split(' ');
  const [day, month, year] = datePart.split('.');
  const [hours, minutes, seconds] = timePart.split(':');
  return new Date(year, month - 1, day, hours, minutes, seconds).toISOString();
};

const shouldFetchData = async (filename) => {
  const TWO_DAYS_IN_MILLISECONDS = 60 * 60 * 1000; // 1 hour
  try {
    const cacheDir = path.join(process.cwd(), 'cache');
    const filePath = path.join(cacheDir, filename);
    const stats = await fs.stat(filePath);
    const currentTime = new Date().getTime();
    const fileModificationTime = new Date(stats.mtime).getTime();

    // Check if the file is older than 2 days
    return currentTime - fileModificationTime > TWO_DAYS_IN_MILLISECONDS;
  } catch (error) {
    // Handle the case where the file doesn't exist or other errors
    return true;
  }
};

/**
 * Reads data from a JSON file or writes data to it if the file doesn't exist.
 * @async
 * @param {string} filename - The name of the JSON file to read from or write to.
 * @param {*} [data=''] - The data to be written to the file if the file doesn't exist.
 * @returns {Promise<Array|Object>} A promise resolving to the parsed JSON data if the file exists and contains valid JSON content, otherwise an empty array.
 * @throws {Error} If any error occurs during file access, reading, or writing.
 */
const readDataJson = async (filename) => {
  try {
    const cacheDir = path.join(process.cwd(), 'cache');
    const filePath = path.join(cacheDir, filename);

    try {
      await fs.access(cacheDir);
    } catch (err) {
      console.log(`Creating ${cacheDir}`);
      await fs.mkdir(cacheDir, { recursive: true });
    }

    try {
      await fs.access(filePath);
      //console.log(`Reading data from file: ${filename}`);
      const fileContent = await fs.readFile(filePath, 'utf8');
      return JSON.parse(fileContent);
    } catch (err) {
      return [];
    }
  } catch (err) {
    console.error(err);
    return [];
  }
};

/**
 * Reads data from a JSON file or writes data to it if the file doesn't exist.
 * @async
 * @param {string} filename - The name of the JSON file to read from or write to.
 * @param {*} [data=''] - The data to be written to the file if the file doesn't exist.
 * @returns {Promise<Array|Object>} A promise resolving to the parsed JSON data if the file exists and contains valid JSON content, otherwise an empty array.
 * @throws {Error} If any error occurs during file access, reading, or writing.
 */
const writeJsonData = async (filename, data = []) => {
  try {
    const cacheDir = path.join(process.cwd(), 'cache');
    const filePath = path.join(cacheDir, filename);

    try {
      await fs.access(cacheDir);
    } catch (err) {
      console.log(`Creating ${cacheDir}`);
      await fs.mkdir(cacheDir, { recursive: true });
    }

    try {
      await fs.access(filePath);
      ///console.log(`Writing data from file: ${filename}`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (err) {
      //console.log(`creating empty file: ${filename}`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    }
  } catch (err) {
    console.error(err);
    return [];
  }
};

const isObjectEmpty = (object) => {
  return Object.keys(object).length === 0 && object.constructor === Object;
};

const isArrayEmpty = (array) => {
  return Array.isArray(array) && array.length === 0;
};

/**
 * Check if a value is empty.
 *
 * @function
 * @param {*} value - The value to check for emptiness.
 * @returns {boolean} Returns true if the value is empty, otherwise false.
 */
const isEmpty = (value) => {
  return (
    value === false ||
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (value.constructor === Object && Object.keys(value).length === 0)
  );
};

/**
 * Find a value in array of objects
 * @date 2/27/2024 - 7:40:37 PM
 *
 * @param {Array} array
 * @param {String} key
 * @param {*} value
 * @returns {Object} object
 */
const findValueInArr = (array, key, value) => {
  // Use the find method to search for an object with the specified key and value
  const foundObject = array.find((obj) => obj[key] === value);

  // Return the found object or null if not found
  return foundObject || null;
};

const betweenRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

const trimAndSanitize = (str) => {
  if (isEmpty(str)) return null;
  const old_str = str;
  str = str
    .trim()
    .replace(/[^а-яА-ЯёЁ\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (str && str !== old_str) return str;
  return null;
};

const areArraysEqual = (arr1, arr2) => {
  function isObjectEqual(obj1, obj2) {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    return keys1.every((key) => {
      if (typeof obj1[key] === 'object' && obj1[key] !== null && obj2[key] !== null) {
        return isObjectEqual(obj1[key], obj2[key]);
      }
      return obj1[key] === obj2[key];
    });
  }

  if (arr1.length !== arr2.length) return false;

  return arr1.every((obj1, index) => {
    const obj2 = arr2[index];
    return isObjectEqual(obj1, obj2);
  });
};

module.exports = {
  delay,
  groupArrayByKey,
  mergeArrays,
  mergeArraysDiff,
  mergeArraysUsingSimilarity,
  writeToJson,
  writeToJsonBOM,
  stringToISODate,
  shouldFetchData,
  isObjectEmpty,
  isArrayEmpty,
  isEmpty,
  findValueInArr,
  betweenRandomNumber,
  readDataJson,
  writeJsonData,
  trimAndSanitize,
  areArraysEqual,
};
