'use server'
import { revalidatePath } from 'next/cache'
import { runAction } from '@/lib/action'
import { requireTenant } from '@/lib/auth/session'
import { formToObject } from '@/lib/validators/common'
import { clientSchema, projectSchema, taskSchema, taskStatusSchema } from '@/lib/validators/clients'
import { createClient, deleteClient, searchWorkspace, updateClient } from '@/lib/services/clients'
import { addTask, createProject, deleteProject, deleteTask, setTaskStatus, updateProject } from '@/lib/services/projects'
import { uuid } from '@/lib/validators/common'
import { getEntitlements, assertModule } from '@/lib/licensing/entitlements'

export async function saveClientAction(id: string | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    assertModule(await getEntitlements(ctx.orgId), 'clients')
    const input = clientSchema.parse(formToObject(formData))
    const clientId = id ? (await updateClient(ctx, uuid.parse(id), input), id) : await createClient(ctx, input)
    revalidatePath('/app/clients')
    revalidatePath(`/app/clients/${clientId}`)
    return { id: clientId }
  })
}

export async function deleteClientAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteClient(ctx, uuid.parse(id))
    revalidatePath('/app/clients')
    return null
  })
}

export async function saveProjectAction(id: string | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    assertModule(await getEntitlements(ctx.orgId), 'projects')
    const input = projectSchema.parse(formToObject(formData))
    const memberIds = formData.getAll('members').filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length < 100)
    const projectId = id ? (await updateProject(ctx, uuid.parse(id), input, memberIds), id) : await createProject(ctx, input, memberIds)
    revalidatePath('/app/projects')
    revalidatePath(`/app/projects/${projectId}`)
    return { id: projectId }
  })
}

export async function deleteProjectAction(id: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteProject(ctx, uuid.parse(id))
    revalidatePath('/app/projects')
    return null
  })
}

export async function addTaskAction(projectId: string, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireTenant()
    const id = await addTask(ctx, uuid.parse(projectId), taskSchema.parse(formToObject(formData)))
    revalidatePath(`/app/projects/${projectId}`)
    return { id }
  })
}

export async function setTaskStatusAction(projectId: string, taskId: string, status: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await setTaskStatus(ctx, uuid.parse(taskId), taskStatusSchema.parse(status))
    revalidatePath(`/app/projects/${projectId}`)
    return null
  })
}

export async function deleteTaskAction(projectId: string, taskId: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    await deleteTask(ctx, uuid.parse(taskId))
    revalidatePath(`/app/projects/${projectId}`)
    return null
  })
}

export async function searchAction(q: string) {
  return runAction(async () => {
    const ctx = await requireTenant()
    return searchWorkspace(ctx, String(q ?? ''))
  })
}
