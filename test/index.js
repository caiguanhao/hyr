var expect = require('chai').expect;
var rewire = require('rewire');
var getInfo = rewire('../info');
var fs = require('fs');

describe('Records', function () {
  it('should get all info in table', function () {
    var getRecords = getInfo.__get__('getRecords');
    var recordsHTML = fs.readFileSync(__dirname + '/fixtures/records.html').toString();
    expect(getRecords).to.be.a('function');
    return getRecords(recordsHTML).then(function (records) {
      expect(records).to.be.an('array');
      expect(records).to.deep.equal([
        { name: '定利宝出借记录',
          keys: [
            '项目名称',
            '过往年化收益率',
            '出借金额',
            '出借期限',
            '过往收益',
            '出借时间',
            '状态'
          ],
          records: [
            [
              '定利宝 DL12',
              '12.00%',
              '100,000.00元',
              '12个月',
              '12000.00元',
              '2015-09-30 10:00:03',
              '出借中'
            ], [
              '定利宝 DL12',
              '12.00%',
              '100,000.00元',
              '12个月',
              '12000.00元',
              '2015-08-30 10:00:03',
              '出借中'
            ]
          ]
        }, {
          name: '散标出借记录',
          keys: [
            '项目名称',
            '年化收益率',
            '出借金额',
            '待收本息',
            '月收本息',
            '期限',
            '出借时间',
            '状态',
            '操作',
          ],
          records: []
        }
      ]);
    });
  });
});
