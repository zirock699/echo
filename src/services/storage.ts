import type { Lesson, Course, StoredAsset } from "../types";

const DB_NAME = "EchoStudio";
const DB_VERSION = 1;

const STORES = {
  COURSES: "courses",
  LESSONS: "lessons",
  ASSETS: "assets",
};

let db: IDBDatabase;

export const initDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.COURSES)) {
        db.createObjectStore(STORES.COURSES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.LESSONS)) {
        const lessonStore = db.createObjectStore(STORES.LESSONS, { keyPath: "id" });
        lessonStore.createIndex("courseId", "courseId");
      }
      if (!db.objectStoreNames.contains(STORES.ASSETS)) {
        db.createObjectStore(STORES.ASSETS, { keyPath: ["lessonId", "type"] });
      }
    };
  });
};

// Courses
export const saveCourse = async (course: Course): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.COURSES], "readwrite");
    const store = tx.objectStore(STORES.COURSES);
    const request = store.put(course);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getCourse = async (id: string): Promise<Course | undefined> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.COURSES], "readonly");
    const store = tx.objectStore(STORES.COURSES);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getAllCourses = async (): Promise<Course[]> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.COURSES], "readonly");
    const store = tx.objectStore(STORES.COURSES);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteCourse = async (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.COURSES, STORES.LESSONS], "readwrite");
    const courseStore = tx.objectStore(STORES.COURSES);
    const lessonStore = tx.objectStore(STORES.LESSONS);

    courseStore.delete(id);

    const index = lessonStore.index("courseId");
    const range = IDBKeyRange.only(id);
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
  });
};

// Lessons
export const saveLesson = async (lesson: Lesson): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LESSONS], "readwrite");
    const store = tx.objectStore(STORES.LESSONS);
    const request = store.put(lesson);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getLesson = async (id: string): Promise<Lesson | undefined> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LESSONS], "readonly");
    const store = tx.objectStore(STORES.LESSONS);
    const request = store.get(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getLessonsByCourse = async (courseId: string): Promise<Lesson[]> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LESSONS], "readonly");
    const store = tx.objectStore(STORES.LESSONS);
    const index = store.index("courseId");
    const range = IDBKeyRange.only(courseId);
    const request = index.getAll(range);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const getAllLessons = async (): Promise<Lesson[]> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LESSONS], "readonly");
    const store = tx.objectStore(STORES.LESSONS);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteLesson = async (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.LESSONS, STORES.ASSETS], "readwrite");
    const lessonStore = tx.objectStore(STORES.LESSONS);
    const assetStore = tx.objectStore(STORES.ASSETS);

    lessonStore.delete(id);

    // Delete assets for this lesson
    const index = assetStore.index("lessonId");
    const range = IDBKeyRange.only(id);
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    request.onerror = () => reject(request.error);
    tx.oncomplete = () => resolve();
  });
};

// Assets
export const saveAsset = async (asset: StoredAsset): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.ASSETS], "readwrite");
    const store = tx.objectStore(STORES.ASSETS);
    const request = store.put(asset);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};

export const getAsset = async (
  lessonId: string,
  type: "audio" | "thumbnail" | "frame"
): Promise<StoredAsset | undefined> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.ASSETS], "readonly");
    const store = tx.objectStore(STORES.ASSETS);
    const request = store.get([lessonId, type]);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const deleteAsset = async (
  lessonId: string,
  type: "audio" | "thumbnail" | "frame"
): Promise<void> => {
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORES.ASSETS], "readwrite");
    const store = tx.objectStore(STORES.ASSETS);
    const request = store.delete([lessonId, type]);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};
