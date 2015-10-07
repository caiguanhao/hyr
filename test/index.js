var fs = require('fs');
var expect = require('chai').expect;
var rewire = require('rewire');
var getInfo = rewire('../info');

function readFile (file) {
  return fs.readFileSync(file).toString();
}

describe('Get Info', function () {
  it('should get records table', function () {
    var getRecords = getInfo.__get__('getRecords');
    var recordsHTML = readFile(__dirname + '/fixtures/records.html');
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

  it('should get account info', function () {
    var getAccountInfo = getInfo.__get__('getAccountInfo');
    var accountHTML = readFile(__dirname + '/fixtures/account.html');
    expect(getAccountInfo).to.be.a('function');
    return getAccountInfo(accountHTML).then(function (account) {
      expect(account).to.be.an('array');
      expect(account).to.deep.equal([
        { key: '用户名', value: '13000000000' },
        { key: '真实姓名', value: '张三' },
        { key: '出生日期', value: '1970-01-01' },
        { key: '身份证号', value: '440***********0000' },
        { key: '性别', value: '男' },
        { key: '汇付用户名', value: 'hclt_hc_13000000000' },
        { key: '汇付号', value: '6000060050000000' },
        { key: '婚姻状态', value: '未填写' },
        { key: '最高学历', value: '未填写' },
        { key: '毕业院校', value: '未填写' },
        { key: '居住地址', value: '未填写' },
        { key: '公司行业', value: '未填写' },
        { key: '公司规模', value: '未填写' },
        { key: '职位状态', value: '未填写' },
        { key: '月收入', value: '未填写' }
      ]);
    });
  });

  it('should get balance info', function () {
    var getBalance = getInfo.__get__('getBalance');
    var balanceHTML = readFile(__dirname + '/fixtures/balance.html');
    expect(getBalance).to.be.a('function');
    return getBalance(balanceHTML).then(function (balance) {
      expect(balance).to.be.an('array');
      expect(balance).to.deep.equal([
        { key: '可用余额', value: '0.00' },
        { key: '冻结金额', value: '0.00' },
        { key: '待收本金', value: '100000.00' },
        { key: '账户总资产', value: '112000.00' },
        { key: '待收收益', value: '12000.00' }
      ]);
    });
  });
});
