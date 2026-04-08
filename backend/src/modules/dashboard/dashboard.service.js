import mongoose from 'mongoose';
import { User } from '../users/user.model.js';

const MODULE_COLLECTIONS = [
  { key: 'users', label: 'Users', collectionName: User.collection.name, alwaysAvailable: true },
  { key: 'admissions', label: 'Admissions', collectionName: 'admissions' },
  { key: 'notices', label: 'Notices', collectionName: 'notices' },
  { key: 'events', label: 'Events', collectionName: 'events' },
];

function buildDateBuckets(days) {
  return Array.from({ length: days }).map((_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));

    return date;
  });
}

async function getAvailableCollections() {
  const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();

  return new Set(collections.map((collection) => collection.name));
}

async function countDocuments(collectionName, availableCollections) {
  if (!availableCollections.has(collectionName)) {
    return 0;
  }

  return mongoose.connection.db.collection(collectionName).countDocuments();
}

async function getModuleStatus(availableCollections) {
  const modules = await Promise.all(
    MODULE_COLLECTIONS.map(async (module) => {
      const total =
        module.key === 'users'
          ? await User.countDocuments()
          : await countDocuments(module.collectionName, availableCollections);

      return {
        key: module.key,
        label: module.label,
        total,
        implemented: module.alwaysAvailable || availableCollections.has(module.collectionName),
      };
    }),
  );

  return modules;
}

async function getUserRegistrations(days = 7) {
  const buckets = buildDateBuckets(days);
  const startDate = buckets[0];

  const registrations = await User.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const countsByDay = new Map(
    registrations.map((entry) => [
      `${entry._id.year}-${entry._id.month}-${entry._id.day}`,
      entry.count,
    ]),
  );

  return buckets.map((date) => {
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

    return {
      key,
      label: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      count: countsByDay.get(key) || 0,
    };
  });
}

async function getRecentActivity(limit = 5) {
  const users = await User.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('email createdAt isActive')
    .lean();

  return users.map((user) => ({
    id: user._id.toString(),
    type: 'USER_REGISTERED',
    title: user.isActive ? 'New user onboarded' : 'Inactive user added',
    description: user.email,
    timestamp: user.createdAt,
  }));
}

export async function getDashboardStats() {
  const availableCollections = await getAvailableCollections();
  const moduleStatus = await getModuleStatus(availableCollections);
  const userModule = moduleStatus.find((module) => module.key === 'users');
  const admissionsModule = moduleStatus.find((module) => module.key === 'admissions');
  const noticesModule = moduleStatus.find((module) => module.key === 'notices');
  const eventsModule = moduleStatus.find((module) => module.key === 'events');
  const activeUsers = await User.countDocuments({ isActive: true });

  return {
    generatedAt: new Date().toISOString(),
    stats: [
      {
        key: 'totalUsers',
        label: 'Total Users',
        value: userModule?.total || 0,
        description: 'Live count of user accounts stored in the platform.',
      },
      {
        key: 'activeUsers',
        label: 'Active Users',
        value: activeUsers,
        description: 'Accounts currently marked active and allowed to authenticate.',
      },
      {
        key: 'totalAdmissions',
        label: 'Admissions',
        value: admissionsModule?.total || 0,
        description: 'Live admission records detected from the backend database.',
      },
      {
        key: 'totalNotices',
        label: 'Notices',
        value: noticesModule?.total || 0,
        description: 'Live notices currently available in persistent storage.',
      },
    ],
    charts: {
      userRegistrations: await getUserRegistrations(),
      entityDistribution: [
        {
          key: 'users',
          label: 'Users',
          value: userModule?.total || 0,
        },
        {
          key: 'admissions',
          label: 'Admissions',
          value: admissionsModule?.total || 0,
        },
        {
          key: 'notices',
          label: 'Notices',
          value: noticesModule?.total || 0,
        },
        {
          key: 'events',
          label: 'Events',
          value: eventsModule?.total || 0,
        },
      ],
    },
    recentActivity: await getRecentActivity(),
    moduleStatus,
  };
}
