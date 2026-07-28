import journal from './meta/_journal.json';
import m0000 from './0000_scheduled_tasks.sql';
import m0001 from './0001_lowly_firestar.sql';
import m0002 from './0002_nosy_joshua_kane.sql';
import m0003 from './0003_sweet_sharon_ventura.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
    m0002,
    m0003,
  },
};
