import journal from './meta/_journal.json';
import m0000 from './0000_scheduled_tasks.sql';
import m0001 from './0002_lowly_firestar.sql';
import m0002 from './0003_nosy_joshua_kane.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
  },
};
