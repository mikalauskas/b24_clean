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
          '&select[]=EMAIL',
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
  const seenValues = new Set();
  return array
    .map((el) => {
      try {
        const item_obj = {
          type: el.TYPE_ID,
          value: el.VALUE,
          dedup_type: dedup_type,
        };

        if (el.VALUE && dedup_type === 'phone') {
          const last10digits = el.VALUE.trim().replace(/\D/g, '').substr(-10);
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
          }
        }

        if (seenValues.has(item_obj)) {
          el.VALUE = '';
        } else {
          seenValues.add(item_obj);
        }

        return el;
      } catch (e) {
        console.error(e);
      }
    })
    .filter(Boolean);
}

const sanitize = async (el) => {
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
  if (!el.PHONE || utils.isArrayEmpty(el.PHONE)) delete el.PHONE;

  el.EMAIL = deduplicateArray(el.EMAIL, 'email');
  if (utils.isEmpty(el.EMAIL)) delete el.EMAIL;

  if (el.LAST_NAME || el.NAME || el.SECOND_NAME || el.PHONE || el.EMAIL) {
    const id = el.ID;
    delete el.ID;
    await updateContact(id, el);
    await utils.delay(350);
  }
};

(async () => {
  const contactList = await getContacts();

  /* for (const el of contactList) {
    const id = el.ID;
    delete el.ID;
    await updateContact(id, el);
    await utils.delay(350);
  } */
})();

/* 

"crm.contact.update", {
  id: 46467,
  fields: {
    "LAST_NAME": utils.trimAndSanitize(el.LAST_NAME),
    "EMAIL": [{
        "ID": 83153,
        "VALUE": ""
    }]
  }
}, 

*/
