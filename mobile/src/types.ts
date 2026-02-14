export type Domain = 'medical' | 'eu';
export type ItemType = 'A' | 'B' | 'AB' | 'K';

export interface Item {
  id: string;
  packId: string;
  domain: Domain;
  subdomain?: string;
  type: ItemType;
  diff: number;
  timeSec: number;
  prompt: string;
  choices: string[];
  correctEnc: string;
  rationaleEnc: string;
  mediaUrl?: string | null;
  tags?: string[];
  displayFrom: number;
  displayTo: number;
}
