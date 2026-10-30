import Clip7 from '../clip7';
import { notFound } from 'next/navigation';
const pages=['download','app','features','account','history','updates','help','legal'];
export async function generateMetadata({params}:{params:Promise<{page:string}>}){const {page}=await params;return {title:({app:'Clip Sevan for Android',download:'Video & audio downloader',features:'Features',account:'Your account',history:'Download history',updates:'What’s new',help:'Help & support',legal:'Privacy & terms'} as Record<string,string>)[page]||'Clip7'};}
export default async function Page({params}:{params:Promise<{page:string}>}){const {page}=await params;if(!pages.includes(page))notFound();return <Clip7 page={page}/>;}
