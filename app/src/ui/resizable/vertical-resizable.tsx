import * as React from 'react'
import { clamp } from '../../lib/clamp'
import { AriaLiveContainer } from '../accessibility/aria-live-container'
import { ResizeDirection, resizableComponentClass } from './resizable'

export const DefaultMaxHeight = 360
export const DefaultMinHeight = 120

interface IVerticalResizableState {
  readonly resizeMessage: string
}

export class VerticalResizable extends React.Component<
  IVerticalResizableProps,
  IVerticalResizableState
> {
  private resizeContainer: HTMLDivElement | null = null
  private startHeight: number | null = null
  private startY: number | null = null

  public constructor(props: IVerticalResizableProps) {
    super(props)
    this.state = { resizeMessage: '' }
  }

  private getCurrentHeight() {
    return this.clampHeight(this.props.height)
  }

  private clampHeight(height: number) {
    const { minimumHeight: min, maximumHeight: max } = this.props
    return clamp(height, min ?? DefaultMinHeight, max ?? DefaultMaxHeight)
  }

  private handleDragStart = (e: React.MouseEvent<any>) => {
    this.startY = e.clientY
    this.startHeight = this.getCurrentHeight()

    document.addEventListener('mousemove', this.handleDragMove)
    document.addEventListener('mouseup', this.handleDragStop)

    e.preventDefault()
  }

  private handleDragMove = (e: MouseEvent) => {
    if (this.startHeight === null || this.startY === null) {
      return
    }

    const deltaY = this.startY - e.clientY
    const newHeight = this.startHeight + deltaY

    this.updateResizeMessage(
      deltaY > 0 ? ResizeDirection.Increase : ResizeDirection.Decrease
    )
    this.props.onResize(this.clampHeight(newHeight))
    e.preventDefault()
  }

  private handleDragStop = (e: MouseEvent) => {
    this.unsubscribeFromGlobalEvents()
    e.preventDefault()
  }

  private unsubscribeFromGlobalEvents() {
    document.removeEventListener('mousemove', this.handleDragMove)
    document.removeEventListener('mouseup', this.handleDragStop)
  }

  private handleMenuResizeEventIncrease = (
    ev?: Event | React.SyntheticEvent<unknown>
  ) => {
    this.handleMenuResizeEvent(ResizeDirection.Increase)
    ev?.preventDefault()
  }

  private handleMenuResizeEventDecrease = (
    ev?: Event | React.SyntheticEvent<unknown>
  ) => {
    this.handleMenuResizeEvent(ResizeDirection.Decrease)
    ev?.preventDefault()
  }

  private handleMenuResizeEvent(resizeDirection: ResizeDirection) {
    const { height } = this.props
    const changedHeight =
      resizeDirection === ResizeDirection.Decrease ? height - 5 : height + 5
    const newHeight = this.clampHeight(changedHeight)

    this.updateResizeMessage(resizeDirection)
    this.props.onResize(newHeight)
  }

  private onResizableRef = (ref: HTMLDivElement | null) => {
    if (ref === null) {
      this.resizeContainer?.removeEventListener(
        'increase-active-resizable-width',
        this.handleMenuResizeEventIncrease
      )
      this.resizeContainer?.removeEventListener(
        'decrease-active-resizable-width',
        this.handleMenuResizeEventDecrease
      )
    } else {
      ref.addEventListener(
        'increase-active-resizable-width',
        this.handleMenuResizeEventIncrease
      )
      ref.addEventListener(
        'decrease-active-resizable-width',
        this.handleMenuResizeEventDecrease
      )
    }
    this.resizeContainer = ref
  }

  private getResizePercentage() {
    const minHeight = this.props.minimumHeight ?? 0
    const maxHeight = this.props.maximumHeight ?? DefaultMaxHeight
    return Math.round(
      ((this.getCurrentHeight() - minHeight) / (maxHeight - minHeight)) * 100
    )
  }

  private updateResizeMessage(direction: ResizeDirection) {
    const directionMessage =
      direction === ResizeDirection.Increase ? 'increased' : 'decreased'
    this.setState({
      resizeMessage: `${
        this.props.description
      } height ${directionMessage}. Set to ${this.getResizePercentage()}%`,
    })
  }

  public render() {
    const style: React.CSSProperties = {
      height: this.getCurrentHeight(),
      maxHeight: this.props.maximumHeight,
      minHeight: this.props.minimumHeight,
    }

    return (
      <div
        id={this.props.id}
        className={`${resizableComponentClass} vertical-resizable-component`}
        style={style}
        ref={this.onResizableRef}
      >
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={this.handleDragStart}
          onDoubleClick={this.props.onReset}
          className="resize-handle"
          aria-label="Resize handle"
        />
        {this.props.children}
        <AriaLiveContainer
          message={this.state.resizeMessage}
          trackedUserInput={this.state.resizeMessage}
        />
      </div>
    )
  }
}

export interface IVerticalResizableProps {
  readonly height: number
  readonly maximumHeight?: number
  readonly minimumHeight?: number
  readonly id?: string
  readonly description: string
  readonly onResize: (newHeight: number) => void
  readonly onReset: () => void
}
