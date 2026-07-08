'use client';

import { SelectionProvider } from '@/context/SelectionContext';
import { RackProvider } from '@/context/RackContext';
import { SavedBlendsProvider } from '@/context/SavedBlendsContext';
import { ReactNode } from 'react';

export default function RootLayoutClient({ children }: { children: ReactNode }) {
  return (
    <SelectionProvider>
      <RackProvider>
        <SavedBlendsProvider>{children}</SavedBlendsProvider>
      </RackProvider>
    </SelectionProvider>
  );
}
