import RolePermissionAddModal from "~/routes/sys/user/components/RolePermissionAddModal";
import RolePermissionEditModal from "~/routes/sys/user/components/RolePermissionEditModal";
import { Avatar, Button, message, Popconfirm } from "antd";
import illustration from "~/assets/illustration.webp";
import { useState } from "react";
import { useRevalidator } from "react-router";
import { DeleteTwoTone, ExclamationCircleFilled } from "@ant-design/icons";
import { removeRole } from "~/services/role";
import { invalidateRoles } from "~/services/roleCache";
import type { Role } from "~/types/api";
const ColorList = ["#1677ff", "#52c41a", "#faad14"];
export default function RoleCards({ roles }: { roles: Role[] }) {
  const [modalStatus, setModalStatus] = useState({
    permissionEdit: false,
    permissionAdd: false,
  });
  const [activeRole, setActiveRole] = useState<Role | null>(null);
  const revalidator = useRevalidator();

  return (
    <>
      <div className="mb-6">
        <RolePermissionAddModal
          open={modalStatus.permissionAdd}
          onClose={() => {
            setModalStatus(pre => ({ ...pre, permissionAdd: false }));
          }}
        />
        <RolePermissionEditModal
          data={activeRole}
          open={modalStatus.permissionEdit}
          onClose={() => {
            setModalStatus(pre => ({ ...pre, permissionEdit: false }));
          }}
        />
        <h2 className="text-xl font-bold text-gray-800">角色</h2>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed max-w-3xl">
          界定成员的访问权限与操作边界。
        </p>
      </div>
      <div className="col-span-8 space-y-6">
        <div className="grid grid-cols-4 gap-4 min-h-36.75">
          {roles.map(item => (
            <div
              key={item.id}
              className="bg-white p-5 rounded-3xl shadow-sm border border-gray-50"
            >
              <div className="flex justify-between items-start mb-4 h-8">
                <span className="text-sm font-medium text-gray-500">
                  共{item.userCount}位用户
                </span>
                <Avatar.Group>
                  {item.usernames.map((v, i) => (
                    <Avatar
                      style={{
                        backgroundColor: ColorList[i % ColorList.length],
                      }}
                      key={v}
                    >
                      {v}
                    </Avatar>
                  ))}
                  {item.userCount > item.usernames.length && (
                    <Avatar
                      style={{ color: "#f56a00", backgroundColor: "#fde3cf" }}
                    >
                      +{item.userCount - item.usernames.length}
                    </Avatar>
                  )}
                </Avatar.Group>
              </div>
              <div className="text-xl font-bold mb-2">{item.roleName}</div>
              <div className="flex justify-between">
                <button
                  type="button"
                  className="cursor-pointer text-[#1677ff] hover:underline"
                  onClick={() => {
                    setActiveRole(item);
                    setModalStatus(pre => ({ ...pre, permissionEdit: true }));
                  }}
                >
                  编辑
                </button>
                <Popconfirm
                  placement="topRight"
                  icon={
                    <ExclamationCircleFilled style={{ color: "#ff4d4f" }} />
                  }
                  title="确认删除该角色？"
                  description="删除后该角色及其权限将被清除，关联用户可能受影响。"
                  onConfirm={async () => {
                    const { code, msg } = await removeRole(item.id);
                    if (code === 0) {
                      message.success(msg);
                      invalidateRoles();
                      await revalidator.revalidate();
                    } else {
                      message.error(msg);
                    }
                  }}
                  okText="确认"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    size="small"
                    type="text"
                    icon={<DeleteTwoTone twoToneColor="#ff4d4f" />}
                    aria-label={`删除角色 ${item.roleName}`}
                    title="删除"
                  />
                </Popconfirm>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 bg-white rounded-3xl px-6 shadow-sm border border-gray-50 min-h-36.75">
            <div className="flex flex-col justify-end">
              <img
                alt="创建自定义角色"
                className="w-26 h-30 object-contain"
                src={illustration}
              />
            </div>
            <div className="py-6 flex flex-col justify-between">
              <div className="flex flex-row-reverse">
                <Button
                  type="primary"
                  onClick={() =>
                    setModalStatus(pre => ({ ...pre, permissionAdd: true }))
                  }
                >
                  创建
                </Button>
              </div>
              <span className="text-sm font-medium text-gray-500 text-right">
                创建自定义角色
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
