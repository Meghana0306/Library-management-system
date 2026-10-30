import { useEffect, useState } from 'react'
import { Avatar, Box, Image, Skeleton, ThemeIcon } from '@mantine/core'
import { IconBook2 } from '@tabler/icons-react'
import { fileClient } from '../../services/api'

const MAX_CACHED_URLS = 100

// Insertion-ordered LRU of path -> object URL. Shared across the app so that
// switching tabs re-uses an already-downloaded avatar or cover.
const objectUrlCache = new Map()
const inFlight = new Map()

const touch = (path) => {
  const url = objectUrlCache.get(path)
  objectUrlCache.delete(path)
  objectUrlCache.set(path, url)
  return url
}

const remember = (path, url) => {
  objectUrlCache.set(path, url)
  while (objectUrlCache.size > MAX_CACHED_URLS) {
    const oldest = objectUrlCache.keys().next().value
    const evicted = objectUrlCache.get(oldest)
    objectUrlCache.delete(oldest)
    if (evicted) URL.revokeObjectURL(evicted)
  }
}

export const clearObjectUrlCache = () => {
  objectUrlCache.forEach((url) => URL.revokeObjectURL(url))
  objectUrlCache.clear()
  inFlight.clear()
}

const fetchObjectUrl = (path) => {
  if (objectUrlCache.has(path)) return Promise.resolve(touch(path))
  if (inFlight.has(path)) return inFlight.get(path)

  const request = fileClient
    .get(path, { responseType: 'blob' })
    .then((response) => {
      const url = URL.createObjectURL(response.data)
      remember(path, url)
      return url
    })
    .finally(() => {
      inFlight.delete(path)
    })

  inFlight.set(path, request)
  return request
}

/**
 * Loads an authenticated image as a blob and hands back a cached object URL.
 * Failures (typically a 404 for an avatar that was never uploaded) resolve to
 * `status: 'error'` without a toast and without touching the session.
 */
export const useObjectUrl = (path) => {
  const [state, setState] = useState(() => (
    path && objectUrlCache.has(path)
      ? { url: objectUrlCache.get(path), status: 'loaded' }
      : { url: null, status: path ? 'loading' : 'idle' }
  ))

  useEffect(() => {
    if (!path) {
      setState({ url: null, status: 'idle' })
      return undefined
    }

    if (objectUrlCache.has(path)) {
      setState({ url: touch(path), status: 'loaded' })
      return undefined
    }

    let active = true
    setState({ url: null, status: 'loading' })

    fetchObjectUrl(path)
      .then((url) => {
        if (active) setState({ url, status: 'loaded' })
      })
      .catch(() => {
        if (active) setState({ url: null, status: 'error' })
      })

    return () => {
      active = false
    }
  }, [path])

  return state
}

const initialsFrom = (name) => String(name || '')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase()

/**
 * Authenticated <img> replacement. `path` is an API-relative files path
 * (see avatarPath/coverPath in services/api).
 */
export const AuthImage = ({
  path,
  kind = 'avatar',
  name,
  alt,
  size = 40,
  width,
  height,
  radius = kind === 'avatar' ? 'xl' : 'sm',
  fit = 'cover',
}) => {
  const { url, status } = useObjectUrl(path)
  const boxWidth = width ?? size
  const boxHeight = height ?? size

  if (status === 'loading') {
    return <Skeleton width={boxWidth} height={boxHeight} radius={radius} />
  }

  if (!url) {
    if (kind === 'avatar') {
      return (
        <Avatar size={boxWidth} radius={radius} color="forest">
          {initialsFrom(name)}
        </Avatar>
      )
    }
    return (
      <ThemeIcon
        variant="light"
        color="gray"
        radius={radius}
        style={{ width: boxWidth, height: boxHeight }}
      >
        <IconBook2 size={16} stroke={1.5} />
      </ThemeIcon>
    )
  }

  if (kind === 'avatar') {
    return <Avatar src={url} alt={alt || name || 'Avatar'} size={boxWidth} radius={radius} />
  }

  return (
    <Box w={boxWidth} h={boxHeight}>
      <Image src={url} alt={alt || 'Cover'} w="100%" h="100%" fit={fit} radius={radius} />
    </Box>
  )
}

export default AuthImage
