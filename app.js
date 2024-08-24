const utils = require('./lib/utils');
const parsePhoneNumber = require('libphonenumber-js');
const emailValidator = require('email-validator');
const nameDetector = require('russian-name-detector')();
const dotenv = require('dotenv');
dotenv.config();

const b24_webhook_url = process.env.B24_WEBHOOK_URL;

const getContacts = async () => {
  let start = 0;
  let next = 0;

  const result = [];

  while (next >= 0) {
    try {
      const response = await fetch(
        b24_webhook_url +
          `crm.contact.list?start=${start}` +
          '&select[]=ID' +
          '&select[]=LAST_NAME' +
          '&select[]=NAME' +
          '&select[]=SECOND_NAME' +
          '&select[]=PHONE' +
          '&select[]=EMAIL' +
          '&order[ID]=DESC',
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${await response.text()}`);
      }

      const res = await response.json();
      await utils.delay(350);
      next = res.next;
      start += 50;

      for (const el of res.result) {
        const newel = await sanitize(el);
        if (newel) result.push(newel);
      }

      await utils.writeJsonData('contacts.json', result);
      console.log(`${start}/${next} [${res.total}]`);
    } catch (error) {
      console.error('Error during get request:', error.message);
    }
  }
  return result;
};

/**
 * update contact
 *
 * @async
 * @param {Number} id
 * @param {Object} fields
 * @returns {boolean}
 */
const updateContact = async (id, fields) => {
  if (utils.isEmpty(fields)) return false;

  const data = {
    id: Number(id),
    fields: fields,
    params: {
      REGISTER_SONET_EVENT: 'N',
    },
  };

  console.log(data);

  try {
    const response = await fetch(b24_webhook_url + `crm.contact.update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to post ${await response.text()}`);
    }

    const res = await response.json();
    return res.result;
  } catch (error) {
    console.error('Error during post request:', error.message);
  }
};

function deduplicateArray(array, dedup_type) {
  if (utils.isEmpty(array)) return null;
  const seenValues = [];
  return array.map((el) => {
    try {
      if (el.VALUE && dedup_type === 'phone') {
        const last10digits = el.VALUE.trim().replace(/\D/g, '').slice(-10);
        const phone = parsePhoneNumber(last10digits, 'RU');
        if (phone && phone.isValid()) {
          el.VALUE = phone.number;
          el.VALUE_TYPE = 'WORK';
        } else {
          el.VALUE = '';
        }
      }

      if (el.VALUE && dedup_type === 'email') {
        const email = emailValidator.validate(el.VALUE);
        if (!email) {
          el.VALUE = '';
        } else {
          el.VALUE_TYPE = 'WORK';
        }
      }

      if (seenValues.includes(el.VALUE)) {
        console.log('Duplicate found:', el.VALUE);
        el.VALUE = '';
      } else {
        seenValues.push(el.VALUE);
      }

      return el;
    } catch (e) {
      console.error('Error processing element:', el, e);
    }
  });
}

function compareContactInfo(obj1, obj2) {
  // Helper function to compare two arrays of objects
  function compareArrays(arr1, arr2) {
    // Check if both arrays are undefined, null, or empty
    if (!arr1 && !arr2) return true;
    if ((!arr1 && arr2) || (arr1 && !arr2)) return false; // One exists and the other doesn't
    if (arr1.length !== arr2.length) return false; // Check if lengths are equal

    // Sort arrays by VALUE or another property for consistent comparison
    arr1 = arr1.sort((a, b) => (a.VALUE > b.VALUE ? 1 : -1));
    arr2 = arr2.sort((a, b) => (a.VALUE > b.VALUE ? 1 : -1));

    // Compare each object in the arrays
    for (let i = 0; i < arr1.length; i++) {
      const item1 = arr1[i];
      const item2 = arr2[i];

      if (
        item1.ID !== item2.ID ||
        item1.VALUE_TYPE !== item2.VALUE_TYPE ||
        item1.VALUE !== item2.VALUE ||
        item1.TYPE_ID !== item2.TYPE_ID
      ) {
        return false;
      }
    }

    return true;
  }

  // Normalize PHONE and EMAIL properties to empty arrays if they are undefined or null
  const phones1 = obj1.PHONE || [];
  const phones2 = obj2.PHONE || [];
  const emails1 = obj1.EMAIL || [];
  const emails2 = obj2.EMAIL || [];

  // Compare PHONE arrays
  const phonesEqual = compareArrays(phones1, phones2);

  // Compare EMAIL arrays
  const emailsEqual = compareArrays(emails1, emails2);

  // Return true if both PHONE and EMAIL arrays are equal
  return phonesEqual && emailsEqual;
}

const sanitize = async (el) => {
  const oldEl = el;

  const fullname = String(
    (el.LAST_NAME ? el.LAST_NAME : '') +
      (el.NAME ? ' ' + el.NAME : '') +
      (el.SECOND_NAME ? ' ' + el.SECOND_NAME : ''),
  );

  if (fullname) {
    try {
      let data = await nameDetector(fullname);
      if (el.LAST_NAME !== data.surname) {
        el.LAST_NAME = data.surname;
      } else {
        delete el.LAST_NAME;
      }

      if (el.NAME !== data.name) {
        el.NAME = data.name;
      } else {
        delete el.NAME;
      }

      if (el.SECOND_NAME !== data.middlename) {
        el.SECOND_NAME = data.middlename;
      } else {
        delete el.SECOND_NAME;
      }
    } catch (e) {
      delete el.LAST_NAME;
      delete el.NAME;
      delete el.SECOND_NAME;
      console.log(fullname, e);
    }
  }

  if (!el.LAST_NAME) delete el.LAST_NAME;

  if (!el.NAME) delete el.NAME;

  if (!el.SECOND_NAME) delete el.SECOND_NAME;

  el.PHONE = deduplicateArray(el.PHONE, 'phone');
  //if (!el.PHONE || utils.isArrayEmpty(el.PHONE)) delete el.PHONE;

  el.EMAIL = deduplicateArray(el.EMAIL, 'email');
  //if (utils.isEmpty(el.EMAIL)) delete el.EMAIL;

  const newEl = el;

  if (!compareContactInfo(oldEl, newEl)) {
    console.log('old el', oldEl);
    console.log('new el', newEl);
    const id = el.ID;
    delete el.ID;
    //await updateContact(id, el);
    //await utils.delay(350);
  }
};

(async () => {
  await getContacts();
})();
