import type { Payload } from 'payload'

import path from 'path'
import { fileURLToPath } from 'url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { NextRESTClient } from '../__helpers/shared/NextRESTClient.js'

import { initPayloadInt } from '../__helpers/shared/initPayloadInt.js'
import { devUser } from '../credentials.js'
import { postsSlug } from './collections/Posts/index.js'

let payload: Payload
let token: string
let restClient: NextRESTClient

const { email, password } = devUser
const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

describe('_Community Tests', () => {
  // --__--__--__--__--__--__--__--__--__
  // Boilerplate test setup/teardown
  // --__--__--__--__--__--__--__--__--__
  beforeAll(async () => {
    const initialized = await initPayloadInt(dirname)
    ;({ payload, restClient } = initialized)

    const data = await restClient
      .POST('/users/login', {
        body: JSON.stringify({
          email,
          password,
        }),
      })
      .then((res) => res.json())

    token = data.token
  })

  afterAll(async () => {
    await payload.destroy()
  })

  // --__--__--__--__--__--__--__--__--__
  // You can run tests against the local API or the REST API
  // use the tests below as a guide
  // --__--__--__--__--__--__--__--__--__

  it('local API example', async () => {
    const newPost = await payload.create({
      collection: postsSlug,
      data: {
        title: 'LOCAL API EXAMPLE',
      },
      context: {},
    })

    expect(newPost.title).toEqual('LOCAL API EXAMPLE')
  })

  it('rest API example', async () => {
    const data = await restClient
      .POST(`/${postsSlug}`, {
        body: JSON.stringify({
          title: 'REST API EXAMPLE',
        }),
        headers: {
          Authorization: `JWT ${token}`,
        },
      })
      .then((res) => res.json())

    expect(data.doc.title).toEqual('REST API EXAMPLE')
  })

  it('graphql Access query should return permissions', async () => {
    const { data, errors } = await restClient
      .GRAPHQL_POST({
        body: JSON.stringify({
          query: `{ Access { canAccessAdmin posts { read { permission } fields { title { read { permission } } } } } }`,
        }),
        headers: {
          Authorization: `JWT ${token}`,
        },
      })
      .then((res) => res.json())

    // Fails: the resolver returns sanitized permissions (`read: true`) but the schema expects `read { permission }`
    expect(errors).toBeUndefined()
    expect(data.Access.posts.read.permission).toBe(true)
    expect(data.Access.posts.fields.title.read.permission).toBe(true)
  })

  it('graphql Access query should return canAccessAdmin when not logged in', async () => {
    const { data, errors } = await restClient
      .GRAPHQL_POST({
        auth: false,
        body: JSON.stringify({ query: `{ Access { canAccessAdmin } }` }),
      })
      .then((res) => res.json())

    // Fails: `canAccessAdmin: false` is removed from the sanitized permissions, but the field is non-nullable
    expect(errors).toBeUndefined()
    expect(data.Access.canAccessAdmin).toBe(false)
  })

  it('graphql docAccess query should return permissions', async () => {
    const post = await payload.create({ collection: postsSlug, data: { title: 'doc access' } })

    const { data, errors } = await restClient
      .GRAPHQL_POST({
        body: JSON.stringify({
          query: `{ docAccessPost(id: ${JSON.stringify(post.id)}) { update { permission } fields { title { update { permission } } } } }`,
        }),
        headers: {
          Authorization: `JWT ${token}`,
        },
      })
      .then((res) => res.json())

    // Fails for the same reason as the Access query
    expect(errors).toBeUndefined()
    expect(data.docAccessPost.update.permission).toBe(true)
    expect(data.docAccessPost.fields.title.update.permission).toBe(true)
  })
})
