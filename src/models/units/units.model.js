'use strict';

import stub from './units.stub.json';

class UnitModel {
  static list(page = 0, limit = 10) {
    return stub;
  }
}

export { UnitModel };
