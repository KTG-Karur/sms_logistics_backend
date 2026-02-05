const { Op, Model } = require("sequelize");
const { arrayOrNotToArray } = require("../utils/utility");

/**
 * To derive a dynamic filter configuration for sequelize where attribute
 * @param {Model} model Sequelize model class
 * @param {{
 * q:string
 * searchKey:string[]
 * filterKey:string[]
 * comparisonKey:string[]
 * dynamicFilterKey:string[]
 * [key:string]:any
 * }} query Request query object
 * @param {{
 * ignoredAttributes:string[]
 * defaultFilterObject:Object
 * defaultMainOpAnd:object[]
 * }} options Additional options
 * @returns {Object}
 */
function whereSearchAndFilter(model, { q, searchKey, filterKey, comparisonKey, dynamicFilterKey, ...filterObject },
    {
        ignoredAttributes = [],
        defaultFilterObject = {},
        defaultMainOpAnd = [],
    } = {}) {
    const searchKeys = arrayOrNotToArray(searchKey);
    const filterKeys = arrayOrNotToArray(filterKey);
    const dynamicFilterKeys = arrayOrNotToArray(dynamicFilterKey);
    const comparisonKeys = arrayOrNotToArray(comparisonKey);
    const filterKeyValues = { ...filterObject };

    const modelAttributes = Object.keys(model.getAttributes())?.filter(attribute => !ignoredAttributes.includes(attribute));

    Object.keys(defaultFilterObject)?.forEach(key => {
        filterKeys.push(key);
        filterKeyValues[key] = defaultFilterObject[key];
    });

    let whereOption = {};
    const filterWhere = [];
    const dynamicFilterWhere = [];
    const searchWhere = [];
    const comparisonWhere = [];

    filterKeys.forEach(key => {
        const queryValue = filterKeyValues[key];
        let value = queryValue;
        if (queryValue == 'null') {
            value = null;
        } else if (queryValue == 'true') {
            value = true;
        } else if (queryValue == 'false') {
            value = false;
        }

        if (queryValue && (modelAttributes.includes(key) || key.includes('.'))) {
            filterWhere.push({
                [key]: value,
            });
        }
    });

    dynamicFilterKeys.forEach(key => {
        const queryValue = filterKeyValues[key];

        if (queryValue) {
            dynamicFilterWhere.push({
                [key]: queryValue,
            });
        }
    });

    const comparisonData = {};
    comparisonKeys.forEach(key => {
        const queryValue = filterKeyValues[key];

        let compareKey;
        let comparisonObject;

        if (key.includes('from_')) {
            compareKey = key.replace('from_', '');
            comparisonObject = {
                from: queryValue
            }
        }
        else if (key.includes('to_')) {
            compareKey = key.replace('to_', '');
            comparisonObject = {
                to: queryValue
            }
        }

        if (queryValue && (modelAttributes.includes(compareKey) || key.includes('.'))) {
            if (!comparisonData[compareKey]) {
                comparisonData[compareKey] = comparisonObject;
            }
            else {
                comparisonData[compareKey] = {
                    ...comparisonData[compareKey],
                    ...comparisonObject,
                };
            }
        }
    })

    q && searchKeys.forEach(key => {
        if (modelAttributes.includes(key) || key.includes('.')) {
            searchWhere.push({
                [key]: {
                    [Op.like]: `%${q}%`,
                }
            });
        }
    })

    Object.keys(comparisonData).forEach(key => {
        const comparisonObject = comparisonData[key];
        console.log(`comparisonObject`, comparisonObject);

        if (comparisonObject && comparisonObject.from && comparisonObject.to) {
            const { from, to } = comparisonObject;

            comparisonWhere.push({
                [key]: {
                    [Op.gte]: from,
                    [Op.lt]: to,
                }
            });
        }
        else if (comparisonObject && comparisonObject.from) {
            const { from } = comparisonObject;

            comparisonWhere.push({
                [key]: {
                    [Op.gte]: from,
                }
            });
        }
        else if (comparisonObject && comparisonObject.to) {
            const { to } = comparisonObject;

            comparisonWhere.push({
                [key]: {
                    [Op.lte]: to,
                }
            });
        }
    })

    let mainOpAnd = [];
    let mainOpOr = [];

    if (defaultMainOpAnd.length) {
        mainOpAnd = [...mainOpAnd, ...defaultMainOpAnd]
    }
    if (filterWhere.length) {
        mainOpAnd = [...mainOpAnd, ...filterWhere]
    }
    if (dynamicFilterWhere.length) {
        mainOpAnd = [...mainOpAnd, ...dynamicFilterWhere]
    }
    if (comparisonWhere.length) {
        mainOpAnd = [...mainOpAnd, ...comparisonWhere]
    }
    if (searchWhere.length) {
        mainOpOr = [...mainOpOr, ...searchWhere]
    }

    if (mainOpAnd.length) {
        whereOption = {
            ...whereOption,
            [Op.and]: mainOpAnd,
        }
    }
    if (mainOpOr.length) {
        whereOption = {
            ...whereOption,
            [Op.or]: mainOpOr,
        }
    }

    return whereOption;
}

module.exports = {
    whereSearchAndFilter,
};