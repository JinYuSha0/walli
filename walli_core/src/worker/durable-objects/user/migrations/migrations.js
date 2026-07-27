import journal from './meta/_journal.json';
import m0000 from './0000_scheduled_tasks.sql';
import m0001 from './0002_lowly_firestar.sql';

export default {
  journal,
  migrations: {
    m0000,
    m0001,
  },
};
