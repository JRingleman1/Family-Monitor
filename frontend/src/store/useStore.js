import { create } from 'zustand';

const useStore = create((set) => ({
  user: null,
  token: null,
  chores: [],
  children: [],

  setUser: (user) => set({ user }),
  setToken: (token) => set({ token }),
  setChores: (chores) => set({ chores }),
  setChildren: (children) => set({ children }),

  addChore: (chore) => set((s) => ({ chores: [...s.chores, chore] })),
  updateChore: (updated) =>
    set((s) => ({ chores: s.chores.map((c) => (c.id === updated.id ? updated : c)) })),
  removeChore: (id) => set((s) => ({ chores: s.chores.filter((c) => c.id !== id) })),

  reset: () => set({ user: null, token: null, chores: [], children: [] }),
}));

export default useStore;
